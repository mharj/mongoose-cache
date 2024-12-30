import type {HydratedDocument, Types} from 'mongoose';

export type DocumentCacheChunk<DocType extends HydratedDocument<unknown>> = {
	chunk: DocType[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
};

export type CacheFilter<DocType extends HydratedDocument<unknown>> = (value: DocType, index: number, array: DocType[]) => boolean;
export type CacheSort<DocType extends HydratedDocument<unknown>> = (a: DocType, b: DocType) => number;

export type ErrorCallbackHandler = (currentId?: Types.ObjectId) => Error;
