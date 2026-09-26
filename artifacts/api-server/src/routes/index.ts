import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import modelsRouter from "./models";
import queueRouter from "./queue";
import settingsRouter from "./settings";
import statusRouter from "./status";
import logsRouter from "./logs";
import arRouter from "./ar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(modelsRouter);
router.use(queueRouter);
router.use(settingsRouter);
router.use(statusRouter);
router.use(logsRouter);
router.use(arRouter);

export default router;
