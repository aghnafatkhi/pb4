import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  {
    extends: [...next],
    rules: {
      // Sticker/template memakai URL dinamis (data/blob/http) yang sengaja
      // digambar ke canvas — next/image tidak memberi manfaat di sini.
      "@next/next/no-img-element": "off",
    },
  },
]);
