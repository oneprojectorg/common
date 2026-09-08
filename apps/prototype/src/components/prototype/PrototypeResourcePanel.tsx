'use client';

import { Button } from '@op/sense/Button';
import { useDirection } from '@op/sense/Direction';
import { Field, FieldLabel } from '@op/sense/Field';
import { Header3 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Sheet, SheetContent, SheetTitle } from '@op/sense/Sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Textarea } from '@op/sense/Textarea';
import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import { LuFile, LuLink, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * The product's resources side panel, showing the Add Resource form — lifted
 * from `DecisionSidePanel` + `ResourcesTabContent` + `AddResourcePanel` so a
 * reviewer can see where adding a resource actually happens today.
 *
 * It is deliberately read-only: the only live controls are the ones that get
 * you out. Everything else is the real markup with its mutations removed —
 * the tab list and the type toggle are controlled with no change handler, the
 * fields are `readOnly` (which is both accurate and still reachable by a
 * screen reader), and submit is disabled. Nothing here writes to the store,
 * because the resource list itself isn't part of this prototype's scope.
 */
export function PrototypeResourcePanel({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  // Sheet's side is physical, so it has to be mirrored to stay at inline-end.
  const isRtl = useDirection() === 'rtl';

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          return;
        }
        onOpenChange(false);
      }}
    >
      <SheetContent
        side={isRtl ? 'left' : 'right'}
        showCloseButton={false}
        className="gap-0 p-0 sm:max-w-[22.5rem]"
      >
        <SheetTitle className="sr-only">
          {t('Decision updates panel')}
        </SheetTitle>

        {/* Controlled with no `onValueChange`: the tabs are part of the picture,
            but Updates has nothing behind it here. */}
        <Tabs value="resources" className="min-h-0 flex-1 gap-0">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pe-4 sm:pt-4">
            <TabsList
              variant="line"
              aria-label={t('Decision side panel tabs')}
              className="grow justify-start border-b-0 px-4 sm:px-6"
            >
              <TabsTrigger value="updates" className="h-auto flex-none">
                {t('Updates')}
              </TabsTrigger>
              <TabsTrigger value="resources" className="h-auto flex-none">
                {t('Resources')}
              </TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label={t('Close')}
            >
              <LuX className="size-5" />
            </Button>
          </div>

          <TabsContent
            value="resources"
            className="flex min-h-0 flex-col overflow-y-auto p-0 sm:p-0"
          >
            {/* The add form is an overlay over the resource list in the
                product. There is no list here, so it is the whole tab — but it
                keeps the overlay's own edge so it reads the same. */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-t-lg border-t border-border bg-white shadow-lg">
                <AddResourcePanel onClose={() => onOpenChange(false)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/** `AddResourcePanel` with its link form, minus everything that submits. */
function AddResourcePanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between p-4 sm:p-6">
        <Header3>{t('Add Resource')}</Header3>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={t('Close')}
        >
          <LuX className="size-4" />
        </Button>
      </div>

      <div className="shrink-0 px-4 py-2 sm:px-6">
        {/* Controlled on `['link']` with no change handler — the Document form
            is a different set of fields we aren't showing. */}
        <ToggleGroup
          className="w-full"
          aria-label={t('Resource type')}
          spacing={0}
          value={['link']}
        >
          <ToggleGroupItem variant="outline" value="link" className="flex-1">
            <LuLink className="size-4" />
            {t('Link')}
          </ToggleGroupItem>
          <ToggleGroupItem
            variant="outline"
            value="document"
            className="flex-1"
          >
            <LuFile className="size-4" />
            {t('Document')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:px-6">
          <Field>
            <FieldLabel htmlFor="resource-url">
              {t('URL')}
              <RequiredAsterisk />
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <LuLink className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                id="resource-url"
                type="text"
                inputMode="url"
                placeholder="https://"
                readOnly
                value=""
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="resource-title">
              {t('Title')}
              <RequiredAsterisk />
            </FieldLabel>
            <Input
              id="resource-title"
              placeholder={t('Add a title')}
              readOnly
              value=""
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="resource-description">
              {t('Description')}
            </FieldLabel>
            <Textarea
              id="resource-description"
              placeholder={t('Add a description')}
              readOnly
              value=""
            />
          </Field>
        </div>

        <div className="sticky bottom-0 flex shrink-0 gap-2 bg-white px-4 py-4 sm:px-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 justify-center"
          >
            {t('Cancel')}
          </Button>
          {/* Disabled for the same reason it is disabled in the product with an
              empty form — not because the prototype can't save. */}
          <Button type="submit" disabled className="flex-1 justify-center">
            {t('Add resource')}
          </Button>
        </div>
      </div>
    </div>
  );
}
