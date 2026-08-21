import { handleApi } from "../lib/platform.js";

export default async function handler(req, res) {
  await handleApi(req, res);
}
