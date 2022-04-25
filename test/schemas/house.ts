import {Schema, model, Document, Types} from 'mongoose';

export interface IHouse {
	name: string;
	cars: Types.ObjectId[];
}

const houseSchema = new Schema<IHouse>({
	name: {type: String, required: true},
	cars: [{type: Schema.Types.ObjectId, index: true, ref: 'car'}],
});

export type HouseDocument = Document<IHouse>;

export const House = model('house', houseSchema);
