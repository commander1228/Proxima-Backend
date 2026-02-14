const MINIMUM_LENGTH = 3;
const MAXIMUM_CONTENT_LENGTH = 2000;
const MAXIMUM_TITLE_LENGTH = 200;

export function isEmptyContent(content?: string){
    return !content || content.trim().length === 0;
}

export function trimContent(content?: string){
    return (content ?? "").trim();
}

export function validateLength(content?: string, title?: string) {
  const c = trimContent(content);
  if (c.length < MINIMUM_LENGTH) {
    throw new Error(`Content must be at least ${MINIMUM_LENGTH} characters`);
  }
  if (c.length > MAXIMUM_CONTENT_LENGTH) {
    throw new Error(`Content must be at most ${MAXIMUM_CONTENT_LENGTH} characters`);
  }
  if (title !== undefined) {
    const t = trimContent(title);
    if (t.length > MAXIMUM_TITLE_LENGTH || t.length < MINIMUM_LENGTH) {
      throw new Error(`Title must be at most ${MAXIMUM_TITLE_LENGTH} and at least ${MINIMUM_LENGTH} characters`);
    }
  }
  return true;
}

export function validatePost(content?: string, title?: string) {
  if (isEmptyContent(content)) {
    throw new Error("Content is required");
  }
  const trimmedContent = trimContent(content);
  const trimmedTitle = title !== undefined ? trimContent(title) : undefined;

  validateLength(trimmedContent, trimmedTitle);

  return { content: trimmedContent, title: trimmedTitle };
}
