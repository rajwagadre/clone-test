    import { Router } from "express";
    import * as userController from "../controllers/user";
    import { upload, convertImagesToWebP } from "../helpers/fileUploader";

    const router = Router();

    router.get("/", userController.getUsers);
    router.get("/:id", userController.getUserById);
    router.put("/:id", upload, convertImagesToWebP, userController.updateUser);
    router.delete("/:id", userController.deleteUser);

    export default router;
