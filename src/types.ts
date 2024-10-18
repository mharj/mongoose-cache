import type {HydratedDocument, Types} from 'mongoose';

export interface AnyCacheChunk {
	chunk: unknown[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
}

export interface DocumentCacheChunk<DocType extends HydratedDocument<unknown>> extends AnyCacheChunk {
	chunk: DocType[];
}

export type CacheFilter<DocType extends HydratedDocument<unknown>> = (value: DocType, index: number, array: DocType[]) => boolean;
export type CacheSort<DocType extends HydratedDocument<unknown>> = (a: DocType, b: DocType) => number;

export type ErrorCallbackHandler = (currentId?: Types.ObjectId) => Error;

export type ValidatorHandler<DocType extends HydratedDocument<unknown> = HydratedDocument<unknown>> = (document: DocType) => boolean | Error;
