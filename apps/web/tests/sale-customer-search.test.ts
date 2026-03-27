import { describe, expect, it } from "vitest";
import { filterCustomersForSaleSearch } from "../src/pages/_app/sales/-components/sale-form/customer-search";

const customers = [
	{
		id: "customer-1",
		name: "João da Silva",
		documentNumber: "123.456.789-00",
		phone: "(11) 91234-5678",
	},
	{
		id: "customer-2",
		name: "Joana Souza",
		documentNumber: "321.654.987-00",
		phone: "(11) 99888-7777",
	},
	{
		id: "customer-3",
		name: "Ana Maria",
		documentNumber: "999.111.222-33",
		phone: "(21) 97777-6666",
	},
] as const;

describe("sale-customer-search", () => {
	it("should return empty list when query has fewer than 3 characters", () => {
		const result = filterCustomersForSaleSearch(customers, "jo");

		expect(result).toEqual([]);
	});

	it("should find customers by name ignoring case and accents", () => {
		const result = filterCustomersForSaleSearch(customers, "joao");

		expect(result.map((customer) => customer.id)).toEqual(["customer-1"]);
	});

	it("should find customers by document number", () => {
		const result = filterCustomersForSaleSearch(customers, "123456");

		expect(result.map((customer) => customer.id)).toEqual(["customer-1"]);
	});

	it("should find customers by phone number", () => {
		const result = filterCustomersForSaleSearch(customers, "97777");

		expect(result.map((customer) => customer.id)).toEqual(["customer-3"]);
	});

	it("should prioritize startsWith matches before includes matches", () => {
		const result = filterCustomersForSaleSearch(customers, "ana");

		expect(result.map((customer) => customer.id)).toEqual([
			"customer-3",
			"customer-2",
		]);
	});
});
