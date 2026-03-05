import { Request, Response } from "express";
import { BlockService } from "../services/BlockService";
import { getUserByDisplayId } from "../services/userService";

const blockService = new BlockService();

export async function blockUser(req: Request, res: Response) {
  try {
    const { displayId } = req.body;
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }

    if (!displayId) {
      return res.status(400).json({ message: "displayId is required" });
    }

    const targetUser = await getUserByDisplayId(displayId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await blockService.blockUser(requester.id, targetUser.id);

    return res.status(201).json({ message: `${displayId} has been blocked` });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function unblockUser(req: Request, res: Response) {
  try {
    const { displayId } = req.body;
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }

    if (!displayId) {
      return res.status(400).json({ message: "displayId is required" });
    }

    const targetUser = await getUserByDisplayId(displayId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await blockService.unblockUser(requester.id, targetUser.id);

    return res.status(200).json({ message: `${displayId} has been unblocked` });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function getBlockList(req: Request, res: Response) {
  try {
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "request from user that does not exist" });
    }

    const blocks = await blockService.getBlockList(requester.id);

    return res.status(200).json({
      blockedUsers: blocks.map((b) => ({
        displayId: b.blocked.displayId,
        blockedAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}