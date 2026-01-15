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
    path: "./src/http/generated",
    clean: true,
  },

  plugins: [
    pluginOas(),
    pluginTs({
      enumType: "asConst",
    }),
    pluginZod(),
    pluginReactQuery({
      client: {
        baseURL: "http://localhost:3333",
        dataReturnType: 'data',
      },
      paramsType: "inline",
      pathParamsType: "object",
    }),
  ],
});
