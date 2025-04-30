// @ts-nocheck
// TODO: commenting for a demo
// import {
// BoldIcon,
// ItalicIcon,
// MoreHorizontal,
// UnderlineIcon,
// } from 'lucide-react';
// import { DialogTrigger, Group, MenuTrigger } from 'react-aria-components';
// import { TimeField } from '../src/components/TimeField';
// import { ToggleButton } from '../src/components/ToggleButton';
// import { Toolbar } from '../src/components/Toolbar';
// import { Tooltip, TooltipTrigger } from '../src/components/Tooltip';
import type { Meta } from '@storybook/react';
import { DialogTrigger } from 'react-aria-components';

import { AlertDialog } from '../src/components/AlertDialog';
// import { Breadcrumb, Breadcrumbs } from '../src/components/Breadcrumbs';
import { Button, ButtonLink } from '../src/components/Button';
import { Header1 } from '../src/components/Header';
// import { Link } from '../src/components/Link';
// import { ListBox, ListBoxItem } from '../src/components/ListBox';
// import { Menu, MenuItem } from '../src/components/Menu';
// import { Meter } from '../src/components/Meter';
import { Modal } from '../src/components/Modal';
// import { Popover } from '../src/components/Popover';
// import { SearchField } from '../src/components/SearchField';
// import { Select, SelectItem } from '../src/components/Select';
// import { Separator } from '../src/components/Separator';
// import { Slider } from '../src/components/Slider';
// import { Cell, Column, Row, Table } from '../src/components/Table';
import { Tab, TabList, TabPanel, Tabs } from '../src/components/Tabs';
import { TextField } from '../src/components/TextField';
import * as ButtonStories from './Button.stories';
import * as TabsStories from './Tabs.stories';
import * as TextFieldStories from './TextField.stories';

const meta: Meta = {
  title: 'All Components',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const AllComponents = () => (
  <div className="flex flex-col gap-8 p-8">
    {/*
    <section>
      <h2 className="mb-4 text-xl font-bold">Alert Dialog</h2>
      <DialogTrigger>
        <Button>Delete…</Button>
        <Modal>
          <AlertDialog
            title="Delete folder"
            variant="destructive"
            actionLabel="Delete"
          >
            Are you sure you want to delete &quot;Documents&quot;? All contents
            will be permanently destroyed.
          </AlertDialog>
        </Modal>
      </DialogTrigger>
    </section>
    */}

    <section>
      <h2 className="mb-4 text-xl font-bold">Buttons</h2>
      <ButtonStories.Example />
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Tabs</h2>
      <TabsStories.Example />
    </section>
    <section>
      <h2 className="mb-4 text-xl font-bold">Input</h2>
      <TextFieldStories.Example />
    </section>
    <section>
      <h2 className="mb-4 text-xl font-bold">Typography</h2>
      <Header1>Header Level 1</Header1>
    </section>

    {/*
    <section>
      <h2 className="mb-4 text-xl font-bold">Breadcrumbs</h2>
      <Breadcrumbs>
        <Breadcrumb href="/">Home</Breadcrumb>
        <Breadcrumb href="/react-aria">React Aria</Breadcrumb>
        <Breadcrumb>Components</Breadcrumb>
      </Breadcrumbs>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Calendar</h2>
      <Calendar aria-label="Event date" />
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Checkbox & CheckboxGroup</h2>
      <div className="flex flex-col gap-4">
        <Checkbox>Single Checkbox</Checkbox>
        <CheckboxGroup label="Cities">
          <Checkbox value="sf">San Francisco</Checkbox>
          <Checkbox value="ny">New York</Checkbox>
          <Checkbox value="london">London</Checkbox>
        </CheckboxGroup>
      </div>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Color Components</h2>
      <div className="flex flex-wrap gap-8">
        <ColorArea />
        <ColorField label="Color Field" defaultValue="#ff0" />
        <ColorPicker label="Color Picker" defaultValue="#ff0" />
        <ColorSlider
          label="Color Slider"
          channel="hue"
          colorSpace="hsl"
          defaultValue="#f00"
        />
        <ColorSwatch color="#f00a" />
      </div>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Date Components</h2>
      <div className="flex flex-col gap-4">
        <DateField label="Date Field" />
        <DatePicker label="Date Picker" />
        <DateRangePicker label="Date Range" />
      </div>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Disclosure</h2>
      <DisclosureGroup>
        <Disclosure>
          <DisclosureHeader>Files</DisclosureHeader>
          <DisclosurePanel>Files content</DisclosurePanel>
        </Disclosure>
        <Disclosure>
          <DisclosureHeader>Images</DisclosureHeader>
          <DisclosurePanel>Images content</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Lists</h2>
      <div className="flex gap-8">
        <GridList aria-label="Grid List" selectionMode="multiple">
          <GridListItem>Item 1</GridListItem>
          <GridListItem>Item 2</GridListItem>
          <GridListItem>Item 3</GridListItem>
        </GridList>

        <ListBox aria-label="List Box" selectionMode="multiple">
          <ListBoxItem>Option 1</ListBoxItem>
          <ListBoxItem>Option 2</ListBoxItem>
          <ListBoxItem>Option 3</ListBoxItem>
        </ListBox>
      </div>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Menu</h2>
      <MenuTrigger>
        <Button className="px-2">
          <MoreHorizontal className="size-5" />
        </Button>
        <Menu>
          <MenuItem id="new">New…</MenuItem>
          <MenuItem id="open">Open…</MenuItem>
          <MenuItem id="save">Save</MenuItem>
        </Menu>
      </MenuTrigger>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Meter</h2>
      <Meter label="Storage space" value={80} />
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Links</h2>
      <Link href="https://example.com">Example Link</Link>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">ComboBox</h2>
      <ComboBox label="Ice cream flavor">
        <ComboBoxItem>Chocolate</ComboBoxItem>
        <ComboBoxItem>Vanilla</ComboBoxItem>
        <ComboBoxItem>Strawberry</ComboBoxItem>
      </ComboBox>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Color Wheel</h2>
      <div className="w-96">
        <ColorWheel />
      </div>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Color Swatch Picker</h2>
      <ColorSwatchPicker>
        <ColorSwatchPickerItem color="#A00" />
        <ColorSwatchPickerItem color="#f80" />
        <ColorSwatchPickerItem color="#080" />
        <ColorSwatchPickerItem color="#08f" />
        <ColorSwatchPickerItem color="#088" />
        <ColorSwatchPickerItem color="#008" />
      </ColorSwatchPicker>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Form</h2>
      <Form className="flex flex-col gap-4">
        <DateField label="Birth date" isRequired />
        <div className="flex gap-2">
          <Button type="submit">Submit</Button>
          <Button type="reset">Reset</Button>
        </div>
      </Form>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Checkbox Group with Validation</h2>
      <Form className="flex flex-col items-start gap-2">
        <CheckboxGroup label="Required Options" isRequired>
          <Checkbox value="1">Option 1</Checkbox>
          <Checkbox value="2">Option 2</Checkbox>
          <Checkbox value="3">Option 3</Checkbox>
        </CheckboxGroup>
        <Button type="submit">Submit</Button>
      </Form>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">ComboBox with Sections</h2>
      <ComboBox label="Preferred fruit or vegetable">
        <ComboBoxSection title="Fruit">
          <ComboBoxItem>Apple</ComboBoxItem>
          <ComboBoxItem>Banana</ComboBoxItem>
          <ComboBoxItem>Orange</ComboBoxItem>
        </ComboBoxSection>
        <ComboBoxSection title="Vegetable">
          <ComboBoxItem>Carrot</ComboBoxItem>
          <ComboBoxItem>Broccoli</ComboBoxItem>
          <ComboBoxItem>Spinach</ComboBoxItem>
        </ComboBoxSection>
      </ComboBox>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">
        Date Range Picker with Validation
      </h2>
      <Form className="flex flex-col items-start gap-2">
        <DateRangePicker label="Trip dates" isRequired />
        <Button type="submit">Submit</Button>
      </Form>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Select</h2>
      <Select label="Favorite Animal">
        <SelectItem>Cat</SelectItem>
        <SelectItem>Dog</SelectItem>
        <SelectItem>Bird</SelectItem>
        <SelectItem>Hamster</SelectItem>
      </Select>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Slider</h2>
      <Slider label="Volume" defaultValue={50} minValue={0} maxValue={100} />
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Search Field</h2>
      <SearchField label="Search" />
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Table</h2>
      <Table aria-label="Example table">
        <Column>Name</Column>
        <Column>Type</Column>
        <Column>Date Modified</Column>
        <Row>
          <Cell>Games</Cell>
          <Cell>Folder</Cell>
          <Cell>6/7/2020</Cell>
        </Row>
        <Row>
          <Cell>Program Files</Cell>
          <Cell>Folder</Cell>
          <Cell>4/7/2021</Cell>
        </Row>
        <Row>
          <Cell>setup.exe</Cell>
          <Cell>Application</Cell>
          <Cell>3/2/2022</Cell>
        </Row>
      </Table>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Time Field</h2>
      <TimeField label="Appointment time" />
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Toggle Button</h2>
      <ToggleButton>
        <MoreHorizontal className="size-4" />
      </ToggleButton>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Toolbar</h2>
      <Toolbar aria-label="Text formatting">
        <Group aria-label="Style" className="contents">
          <ToggleButton aria-label="Bold" className="p-2.5">
            <BoldIcon className="size-4" />
          </ToggleButton>
          <ToggleButton aria-label="Italic" className="p-2.5">
            <ItalicIcon className="size-4" />
          </ToggleButton>
          <ToggleButton aria-label="Underline" className="p-2.5">
            <UnderlineIcon className="size-4" />
          </ToggleButton>
        </Group>
        <Separator orientation="vertical" />
        <Group aria-label="Clipboard" className="contents">
          <Button>Copy</Button>
          <Button>Paste</Button>
          <Button>Cut</Button>
        </Group>
        <Separator orientation="vertical" />
        <Checkbox>Night Mode</Checkbox>
      </Toolbar>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Tooltip</h2>
      <TooltipTrigger>
        <Button>Hover me</Button>
        <Tooltip>Helpful information</Tooltip>
      </TooltipTrigger>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Popover</h2>
      <DialogTrigger>
        <Button>Open Popover</Button>
        <Popover>
          <div className="p-4">
            <h3 className="text-lg font-bold">Popover Title</h3>
            <p>This is the popover content.</p>
          </div>
        </Popover>
      </DialogTrigger>
    </section>
    */}
  </div>
);
