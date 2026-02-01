import { Request, response, Response } from "express";
import {
  getUserByDisplayId,
  getUserById,
  setUserDeleted,
  setUserDisplayId,
  userNameInUse,
} from "../services/userService";

export async function deleteUser(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    const user = req.user;

    const userToDelete = await getUserById(userId);

    if (!userToDelete) {
      return res.status(404).json({ message: "User Not Found" });
    }

    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }

    if (user.id != userId && !user.isAdmin) {
      return res.status(403).json({ message: "action not Authorized" });
    }

    const deletedUser = await setUserDeleted(userToDelete);

    return res.status(201).json({
      message: `user ${userToDelete.displayId} has been deleted`,
      userToDelete,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function changeUsername(req: Request, res: Response) {
  try {
    const { newUserName } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }

    if (await(userNameInUse(newUserName))){
        return res.status(409).json({ message: "Username already in use"})
    }

    await setUserDisplayId(newUserName, user);

    return res.status(201).json({
      message: `userName has been changed to ${newUserName}`,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
