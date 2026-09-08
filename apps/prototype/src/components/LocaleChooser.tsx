import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { LuGlobe } from 'react-icons/lu';

/**
 * PROTOTYPE ONLY.
 *
 * The header's language button, matching the real one's trigger exactly. It does
 * not switch languages: this build has no dictionaries — the copy is the string
 * in the source — so a working chooser would have nothing to choose between.
 */
export const LocaleChooser = () => (
  <Button
    variant="outline"
    size="icon"
    aria-label="Select language"
    onClick={() => toast.info('Prototype: this build is English only')}
  >
    <LuGlobe className="size-4" />
  </Button>
);
