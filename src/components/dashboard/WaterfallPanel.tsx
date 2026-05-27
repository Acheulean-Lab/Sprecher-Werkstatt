import type { Measurement } from '../../types';
import { ImpulseView } from './ImpulseView';
import { Waterfall } from './Waterfall';

export function WaterfallPanel({ measurement }: { measurement: Measurement }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <ImpulseView measurement={measurement} />
      <Waterfall measurement={measurement} />
    </div>
  );
}
