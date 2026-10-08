// Key micronutrients for an Indian, lifting adult: daily targets (approx. ICMR-NIN 2020 RDA, sedentary adults)
// and everyday sources. JimBuddy's food data has no micronutrient values, so these are guidance, not tracked intake.

export interface Micro {
  name: string;
  unit: string;
  male: number;
  female: number;
  limit?: boolean; // an upper limit rather than a target
  why: string;
  sources: string;
}

export const MICROS: Micro[] = [
  { name: 'Iron', unit: 'mg', male: 19, female: 29, why: 'Carries oxygen; low iron feels like constant tiredness.', sources: 'Rajma, chana, spinach, jaggery, eggs, chicken liver' },
  { name: 'Calcium', unit: 'mg', male: 1000, female: 1000, why: 'Bones and muscle contraction.', sources: 'Milk, curd, paneer, ragi, sesame (til)' },
  { name: 'Vitamin D', unit: 'µg', male: 15, female: 15, why: 'Bone strength and muscle function; many Indians run low.', sources: '15–20 min of midday sun, eggs, fatty fish, fortified milk' },
  { name: 'Vitamin B12', unit: 'µg', male: 2.5, female: 2.5, why: 'Nerves and red blood cells; often low on vegetarian diets.', sources: 'Milk, curd, paneer, eggs, fish, chicken' },
  { name: 'Folate', unit: 'µg', male: 300, female: 220, why: 'Making new cells, including after training.', sources: 'Dal, chana, green leafy veg, peanuts' },
  { name: 'Zinc', unit: 'mg', male: 17, female: 13, why: 'Muscle repair, immunity, testosterone.', sources: 'Pumpkin seeds, chickpeas, cashews, eggs, meat' },
  { name: 'Magnesium', unit: 'mg', male: 440, female: 370, why: 'Muscle relaxation, sleep and energy.', sources: 'Nuts, seeds, whole grains, bananas, dark chocolate' },
  { name: 'Potassium', unit: 'mg', male: 3500, female: 3500, why: 'Fluid balance and muscle cramps.', sources: 'Bananas, coconut water, potatoes, dal, curd' },
  { name: 'Vitamin C', unit: 'mg', male: 80, female: 65, why: 'Recovery and helps you absorb plant iron.', sources: 'Amla, guava, orange, lemon, tomato' },
  { name: 'Sodium', unit: 'mg', male: 2000, female: 2000, limit: true, why: 'Keep under this; mess food and pickles add up fast.', sources: 'Salt, pickles, papad, namkeen, sauces' },
];

export const microTarget = (m: Micro, sex: 'male' | 'female' | undefined) => (sex === 'female' ? m.female : m.male);
