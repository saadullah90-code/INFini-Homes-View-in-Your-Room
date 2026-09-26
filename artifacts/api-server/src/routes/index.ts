import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import modelsRouter from "./models";
import queueRouter from "./queue";
import settingsRouter from "./settings";
import statusRouter from "./status";
import logsRouter from "./logs";
import arRouter from "./ar";
import shopifyAuthRouter from "./shopify-auth";
import shopifyWebhooksRouter from "./shopify-webhooks";
import storefrontRouter from "./storefront";
import liquidSourceRouter from "./liquid-source";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(modelsRouter);
router.use(queueRouter);
router.use(settingsRouter);
router.use(statusRouter);
router.use(logsRouter);
router.use(arRouter);
router.use(shopifyAuthRouter);
router.use(shopifyWebhooksRouter);
router.use(storefrontRouter);
router.use(liquidSourceRouter);

export default router;
