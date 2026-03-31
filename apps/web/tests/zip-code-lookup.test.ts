import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupZipCode } from "../src/lib/zip-code-lookup";

describe("zip-code-lookup", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
		fetchMock.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each(["01001-000", "01001000"])(
		"should resolve normalized address for valid zip code (%s)",
		async (zipCodeInput) => {
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						cep: "01001-000",
						logradouro: "Praça da Sé",
						complemento: "lado ímpar",
						bairro: "Sé",
						localidade: "São Paulo",
						uf: "SP",
					}),
					{ status: 200 },
				),
			);

			const result = await lookupZipCode(zipCodeInput);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock).toHaveBeenCalledWith(
				"https://viacep.com.br/ws/01001000/json/",
				expect.any(Object),
			);
			expect(result).toEqual({
				zipCode: "01001-000",
				street: "Praça da Sé",
				neighborhood: "Sé",
				city: "São Paulo",
				state: "SP",
				country: "BR",
				complement: "lado ímpar",
			});
		},
	);

	it("should return null for invalid zip code length", async () => {
		const result = await lookupZipCode("12345");

		expect(result).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("should return null when provider reports erro", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ erro: true }), { status: 200 }),
		);

		const result = await lookupZipCode("01001000");

		expect(result).toBeNull();
	});

	it("should return null when response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(null, { status: 500, statusText: "Internal Server Error" }),
		);

		const result = await lookupZipCode("01001000");

		expect(result).toBeNull();
	});

	it("should return null on network error", async () => {
		fetchMock.mockRejectedValueOnce(new Error("Network error"));

		const result = await lookupZipCode("01001000");

		expect(result).toBeNull();
	});

	it("should return null when request is aborted", async () => {
		fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

		const result = await lookupZipCode("01001000");

		expect(result).toBeNull();
	});
});
