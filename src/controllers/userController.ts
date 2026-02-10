import { Request, response, Response } from "express";
import {
  getUserByDisplayId,
  getUserById,
  getUserKarma,
  setUserDeleted,
  setUserDisplayId,
  userNameInUse,
} from "../services/userService";
import { updateUserProximityRadius } from "../dao/userServiceDao";
import { ChatRoomMessageService } from "../services/ChatRoomMessageService";

const chatRoomMessageService = new ChatRoomMessageService();

export async function deleteUser(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    const user = req.user;

    const userToDelete = await getUserById(userId);

    if (!userToDelete) {
      return res.status(404).json({ message: "User Not Found" });
    }

    if (!user) {
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    if (user.id != userId && !user.isAdmin) {
      return res.status(403).json({ message: "action not Authorized" });
    }

    const deletedUser = await setUserDeleted(userToDelete);

    return res.status(201).json({
      message: `user ${userToDelete.displayId} has been deleted`,
      deletedUser,
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
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    if (await userNameInUse(newUserName)) {
      return res.status(409).json({ message: "Username already in use" });
    }

    await setUserDisplayId(newUserName, user);

    return res.status(201).json({
      message: `userName has been changed to ${newUserName}`,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function userDetails(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    return res.status(200).json({
      username: user.displayId,
      email: user.email,
      created: user.createdAt,
      message: "user details retrieved",
      isAdmin: user.isAdmin,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function userStatistics(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json({ message: "request from user that does not exist" });
    }

    const messageCount = await chatRoomMessageService.getMessageCountByUser(user.id);
    const userKarma = await getUserKarma(user.id);

    return res.status(200).json({ messageCount, userKarma });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function changeUserProximityRadius(req: Request, res: Response) {
  try {
    const {newProximityRadius} = req.body;
    const user = req.user;

    if (typeof newProximityRadius !== "number"){
      throw new Error("Radius must be a number");
    }
    
  if(newProximityRadius >= 999999){
  throw new Error("Radius value too large");
  }
  if(newProximityRadius <= 10){
    throw new Error("Radius value too small");
  }

  if(!user){
    return res
        .status(401)
        .json({ message: "request from user that does not exist" });
  }

  await updateUserProximityRadius(user.id, newProximityRadius);

  return res.status(200).json({
    message: `user proximity radius setting has been changed to ${newProximityRadius}`
  });
} catch (error: any) {
    return res.status(400).json({ message: error.message });
}
}

