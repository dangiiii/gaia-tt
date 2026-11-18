import { TopicKey } from '@/lib/topicConfig';

/** Topics with precomputed simulation outputs under public/outputs/. */
export const SIMULATION_OUTPUT_FOLDERS: Partial<Record<TopicKey, string>> = {
  nuclear: 'nuclear_tt',
  fossil_fuels: 'fossil_fuel_tt_v2',
};
