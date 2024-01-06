import type {Document, HydratedDocument, Types} from 'mongoose';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseDoc = Document<Types.ObjectId, any, any>;

export type AnyHydratedDocument = HydratedDocument<BaseDoc>;
