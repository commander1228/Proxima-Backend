/**
 * ReportDao.ts
 * ============
 * All direct Prisma calls for the Report model.
 *
 * The @@unique([reporterId, contentType, contentId]) constraint on the model
 * means Prisma will throw a P2002 error if a user tries to report the same
 * piece of content twice. ReportService catches that and converts it into a
 * human-readable message.
 */

import { ContentType } from "@prisma/client";
import { prisma } from "../utils/prisma";

export type CreateReportInput = {
  reporterId:            number;
  reportedUserId:        number;
  reportedUserDisplayId: string;
  contentType:           ContentType;
  contentId:             number;
  content:               string | null;
  imageUrl:              string | null;
};

export class ReportDao {
  /**
   * Persists a new report.
   * Throws Prisma P2002 if this reporter has already reported this content.
   */
  async createReport(data: CreateReportInput) {
    return prisma.report.create({ data });
  }


  async hasReported(
    reporterId:  number,
    contentType: ContentType,
    contentId:   number,
  ): Promise<boolean> {
    const existing = await prisma.report.findUnique({
      where: {
        reporterId_contentType_contentId: { reporterId, contentType, contentId },
      },
    });
    return !!existing;
  }
}