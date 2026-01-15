import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginZod } from "@kubb/plugin-zod";
import { pluginReactQuery } from "@kubb/plugin-react-query";

export default defineConfig({
  /**
   * Cache interno do Kubb
   */
  root: ".",

  /**
   * Fonte do contrato
   */
  input: {
    path: "http://localhost:3333/docs/json",
  },

  /**
   * Onde o client será gerado
   */
  output: {
    path: "./packages/api-client/src",
    clean: true,
  },

  plugins: [
    /**
     * Normaliza o OpenAPI
     */
    pluginOas(),

    /**
     * Gera os types TypeScript
     */
    pluginTs({
      enumType: "asConst",
    }),

    /**
     * Gera schemas Zod
     */
    pluginZod(),

    /**
     * Gera hooks React Query
     */
    pluginReactQuery({
      client: {
        client: "fetch"
      },
      pathParamsType: "object",
      paramsType: "object",
    }),
  ],
});
