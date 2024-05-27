import type {Document, HydratedDocument, Types} from 'mongoose';

export type BaseDoc = Document<Types.ObjectId>;

export type AnyHydratedDocument = HydratedDocument<BaseDoc>;

export interface AnyCacheChunk {
	chunk: unknown[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
}

export interface DocumentCacheChunk<DocType extends AnyHydratedDocument> extends AnyCacheChunk {
	chunk: DocType[];
}

export type CacheFilter<DocType extends AnyHydratedDocument> = (value: DocType, index: number, array: DocType[]) => boolean;
export type CacheSort<DocType extends AnyHydratedDocument> = (a: DocType, b: DocType) => number;

export type ErrorCallbackHandler = (currentId?: Types.ObjectId) => Error;

export type ValidatorHandler<DocType extends AnyHydratedDocument = AnyHydratedDocument> = (document: DocType) => boolean | Error;
