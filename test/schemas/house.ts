import {Schema, model, Types, HydratedDocument} from 'mongoose';

export interface IHouse {
	name: string;
	cars: Types.ObjectId[];
}

export type HouseDocument = HydratedDocument<IHouse>;

const houseSchema = new Schema<IHouse>({
	name: {type: String, required: true},
	cars: [{type: Schema.Types.ObjectId, index: true, ref: 'car'}],
});

export const House = model<IHouse>('house', houseSchema);
