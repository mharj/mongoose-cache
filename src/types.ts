import type {Types} from 'mongoose';

export type HydratedDocumentLike<ID extends Types.ObjectId = Types.ObjectId> = {
	_id: ID;
};

export type DocumentCacheChunk<DocType extends HydratedDocumentLike> = {
	chunk: DocType[];
	total: number;
	haveMore: boolean;
	size: number;
	index: number;
};

export type CacheFilter<DocType extends HydratedDocumentLike> = (value: DocType, index: number, array: DocType[]) => boolean;
export type CacheSort<DocType extends HydratedDocumentLike> = (a: DocType, b: DocType) => number;

export type ErrorCallbackHandler = (currentId?: Types.ObjectId) => Error;
