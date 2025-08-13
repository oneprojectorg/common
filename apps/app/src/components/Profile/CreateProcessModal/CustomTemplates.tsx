import { Button } from '@op/ui/Button';
import {
  ArrayFieldTemplateProps,
  BaseInputTemplateProps,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';

export const FieldTemplate = (props: FieldTemplateProps) => {
  const { children } = props;

  return <div className="mb-4">{children}</div>;
};

export const ObjectFieldTemplate = (props: ObjectFieldTemplateProps) => {
  const { properties, title, description } = props;

  // Special handling for the decision-making phases step
  if (title === 'Set up your decision-making phases') {
    return (
      <div className="space-y-6">
        {properties.map((prop: any) => prop.content)}
      </div>
    );
  }

  // Special handling for individual phase groups (nested objects within phases step)
  // Check if this is a nested object that contains date fields
  const isPhaseGroup = properties.every(
    (prop: any) =>
      prop.name &&
      (prop.name.includes('Open') ||
        prop.name.includes('Close') ||
        prop.name === 'resultsDate'),
  );

  if (isPhaseGroup && properties.length > 0) {
    return (
      <div className="mb-6">
        <h4 className="mb-4 text-sm font-medium text-neutral-charcoal">
          {title}
        </h4>
        {description && (
          <p className="mb-4 text-sm text-neutral-gray4">{description}</p>
        )}
        <div
          className={properties.length === 2 ? 'grid grid-cols-2 gap-4' : ''}
        >
          {properties.map((prop: any) => prop.content)}
        </div>
      </div>
    );
  }

  // Default template for other steps
  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-base font-medium text-neutral-charcoal">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-neutral-gray4">{description}</p>
      )}
      {properties.map((prop: any) => prop.content)}
    </div>
  );
};

export const ArrayFieldTemplate = (props: ArrayFieldTemplateProps) => {
  const { items, canAdd, onAddClick, title, schema } = props;

  return (
    <div className="space-y-4">
      {title && (
        <label className="text-sm font-medium text-neutral-charcoal">
          {title}
        </label>
      )}
      {schema.description && (
        <p className="text-xs text-neutral-gray4">{schema.description}</p>
      )}
      <div className="space-y-2">
        {items.map((element: any) => (
          <div key={element.key} className="flex items-center gap-2">
            <div className="flex-1">{element.children}</div>
            {element.hasRemove && (
              <Button
                size="small"
                variant="primary"
                onPress={element.onDropIndexClick(element.index)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      {canAdd && (
        <Button size="small" variant="primary" onPress={onAddClick}>
          Add {title?.toLowerCase() || 'item'}
        </Button>
      )}
    </div>
  );
};

export const BaseInputTemplate = (props: BaseInputTemplateProps) => {
  return <>{props.children}</>;
};

export const CustomTemplates = {
  FieldTemplate,
  ObjectFieldTemplate,
  ArrayFieldTemplate,
  BaseInputTemplate,
};
