type CustomerProps = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}
export class CustomerModel {
    constructor(private props: CustomerProps) { }

    public static create(props: CustomerProps): CustomerModel {
        return new CustomerModel(props);
    }

    public get Id() {
        return this.props.id;
    }

    public get FirstName() {
        return this.props.firstName;
    }

    public get LastName() {
        return this.props.lastName;
    }

    public get Email() {
        return this.props.email;
    }

    public setDefaultEmailDomain(): CustomerModel {
        if (!this.props.email.includes('@')) {
            this.props.email = `${this.props.email}@hotmail.com`;
        }
        return this;
    }

    public toObject(): CustomerProps {
        return {
            email: this.props.email,
            firstName: this.props.firstName,
            id: this.props.id,
            lastName: this.props.lastName
        };
    }
}    
