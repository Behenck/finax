import { defineConfig } from "@kubb/core";
import { pluginClient } from "@kubb/plugin-client";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginZod } from "@kubb/plugin-zod";

export default defineConfig({
  root: ".",
  input: {
    path: "http://localhost:3333/docs/json",
  },
  output: {
    path: "./http/generated",
    clean: true,
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: {
        path: "models",
      },
    }),
    pluginZod(),
    pluginClient({
      output: {
        path: ".",
        override: true,
      },
      importPath: "@/lib/kubb-client",
      dataReturnType: "data",
      paramsType: "object",
    }),
    pluginReactQuery({
      client: {
        dataReturnType: "data",
      },
      paramsType: "object",
      pathParamsType: "object",
    }),
  ],
});
