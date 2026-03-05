/**
 * reportController.ts
 * ===================
 * POST /api/report
 *
 * Body: { contentType: ContentType, contentId: number }
 *
 * The input is validated by express-validator in the route file before
 * this handler is called.
 */

import { Request, Response } from "express";
import { ContentType } from "@prisma/client";
import { ReportService } from "../services/ReportService";

const reportService = new ReportService();

export async function submitReport(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { contentType, contentId } = req.body as {
      contentType: ContentType;
      contentId:   number;
    };

    await reportService.createReport(user.id, contentType, Number(contentId));

    return res.status(201).json({ message: "Report submitted" });
  } catch (error: any) {
    // Distinguish client errors from server errors
    const clientErrors = [
      "Content not found",
      "You cannot report your own content",
      "You have already reported this content",
    ];
    const status = clientErrors.includes(error.message) ? 400 : 500;
    return res.status(status).json({ message: error.message });
  }
}