import cds, { Request, service, Service } from "@sap/cds";
import { Customers, Product, Products, SalesOrderHeaders, SalesOrderItem, SalesOrderItems } from "@models/sales";
import { log } from "node:console";

export default (service: Service) => {

    service.before('READ', '*', (request: Request) => {
        if(!request.user?.is("read_only_user")) {
            request.reject(403, "Não autorizado");
        }
    });

    service.before(['WRITE','DELETE'], '*', (request: Request) => {
        if(!request.user?.is("admin")) {
            request.reject(403, "Não autorizado escrita e deleção");
        }
    });

    service.after("READ", 'Customers', (results: Customers) => {
        results.forEach(customer => {
            if (!customer.email?.includes("@")) {
                customer.email = `${customer.email}@hotmail.com`;
            }
        })
    });

    service.before("CREATE", 'SalesOrderHeaders', async (request: Request) => {
        const param = request.data;
        const items: SalesOrderItems = param.items;
        if (!param.customer_id) {
            return request.reject(400, "customer_id is required");
        }

        if (!param.items || param.items?.length === 0) {
            return request.reject(400, "items is required");
        }

        const customer = SELECT.one.from('sales.Customers').where({ id: param.customer_id });
        //console.log(JSON.stringify(customer));

        const custumerResultQuery = await cds.run(customer)
        if (!custumerResultQuery) {
            return request.reject(404, `Customer not found`);
        }

        const productIds: string[] = param.items.map((item: SalesOrderItem) => item.product_id);
        const productsQuery = SELECT.from('sales.Products').where({ id: productIds });
        //console.log(JSON.stringify(productsQuery));

        const productsResultQuery: Products = await cds.run(productsQuery);
        //const productsMap = productsResultQuery.map((product) => product.id);

        for (const item of param.items) {
            const product = productsResultQuery.find((prod) => prod.id === item.product_id);
            if (!product) {
                return request.reject(400, `products ${item.product_id} not found`);
            }
            if (product.stock === 0) {
                return request.reject(400, `products ${item.product_id} - ${product.name} are out of stock`);
            }
        }
        console.log(param);
        
        let totalAmount = 0;
        items.forEach((item => {
            totalAmount += (item.price as number) * (item.quantity as number);
        }));
        request.data.totalAmount = totalAmount;
    });

    service.after("CREATE", 'SalesOrderHeaders', async (results: SalesOrderHeaders) => {
        const headerAsArray = Array.isArray(results) ? results : [results] as SalesOrderHeaders;
        for (const header of headerAsArray) {
            const items = header.items as SalesOrderItems;
            const productsData = items.map(item => ({
                id: item.product_id as string,
                quantity: item.quantity as number
            }));
            const productIds: string[] = productsData.map((productsData) => productsData.id);
            const productsQuery = SELECT.from('sales.Products').where({ id: productIds });
            const productsResultQuery: Products = await cds.run(productsQuery);
            for (const productData of productsData) {
                const foundProduct = productsResultQuery.find((prod) => prod.id === productData.id) as Product;
                foundProduct.stock = (foundProduct.stock as number) - productData.quantity;
                await cds.run(UPDATE('sales.Products').set(foundProduct).where({ id: foundProduct.id }));
            }
        }

    });
};