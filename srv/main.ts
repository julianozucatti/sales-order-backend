import cds, { Request, service, Service } from "@sap/cds";
import { Customers, Product, Products, SalesOrderHeaders, SalesOrderItem, SalesOrderItems } from "@models/sales";
import { log } from "node:console";
import { CustomerServiceImpl } from "./services/customer/implementation";
import { FullRequestParams } from "./protocols";

export default (service: Service) => {

    service.before('READ', '*', (request: Request) => {
        if (!request.user?.is("read_only_user")) {
            request.reject(403, "Não autorizado");
        }
    });

    service.before(['WRITE', 'DELETE'], '*', (request: Request) => {
        if (!request.user?.is("admin")) {
            request.reject(403, "Não autorizado escrita e deleção");
        }
    });

    service.after("READ", 'Customers', (customerList: Customers, request) => {
        (request as unknown as FullRequestParams<Customers>).results = new CustomerServiceImpl().afterRead(customerList);
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

        if (totalAmount > 3000) {
            const discount = totalAmount * 0.1;
            totalAmount = totalAmount - discount;
        }

        request.data.totalAmount = totalAmount;
    });

    service.after("CREATE", 'SalesOrderHeaders', async (results: SalesOrderHeaders, request: Request) => {
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

            const headerAsString = JSON.stringify(header);
            const userAsString = JSON.stringify(request.user);
            const log = [{
                header_id: header.id,
                userData: userAsString,
                orderData: headerAsString
            }];
            await cds.create('sales.Sales').entries(log);

        }

    });
};