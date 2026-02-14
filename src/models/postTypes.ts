export type CreatePostInput = {
    posterId: number,
    locationId:number,
    title: string,
    content: string
};

export type createPostCommentInput = {
    commenterId: number,
    postId: number,
    content:string
};