export type CreatePostInput = {
    posterId: number,
    locationId:number,
    title: string,
    content?: string,
    imageUrl?: string,
    wasAnonymous?: boolean,
};

export type createPostCommentInput = {
    commenterId: number,
    postId: number,
    content:string,
    imageUrl?: string,
    wasAnonymous?: boolean,
};
