import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../src/components/Command';

export default {
  title: 'Command',
  component: Command,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Example = () => (
  <div className="w-full max-w-md space-y-8">
    <div className="space-y-4">
      <h3 className="font-medium">Basic Command Menu</h3>
      <div className="rounded-lg border border-neutral-gray3">
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions" hidden={false}>
              <CommandItem>
                <span>Calendar</span>
              </CommandItem>
              <CommandItem>
                <span>Search Emoji</span>
              </CommandItem>
              <CommandItem>
                <span>Calculator</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings" hidden={false}>
              <CommandItem>
                <span>Profile</span>
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>Billing</span>
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>Settings</span>
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">File Actions</h3>
      <div className="rounded-lg border border-neutral-gray3">
        <Command>
          <CommandInput placeholder="Search files..." />
          <CommandList>
            <CommandEmpty>No files found.</CommandEmpty>
            <CommandGroup heading="Recent Files" hidden={false}>
              <CommandItem>
                <span>📄 Document.pdf</span>
                <CommandShortcut>2m ago</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>📊 Spreadsheet.xlsx</span>
                <CommandShortcut>1h ago</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>🖼️ Image.png</span>
                <CommandShortcut>3h ago</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions" hidden={false}>
              <CommandItem>
                <span>New File</span>
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>Open File</span>
                <CommandShortcut>⌘O</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>Save As</span>
                <CommandShortcut>⌘⇧S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="font-medium">Navigation Menu</h3>
      <div className="rounded-lg border border-neutral-gray3">
        <Command>
          <CommandInput placeholder="Go to page..." />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            <CommandGroup heading="Pages" hidden={false}>
              <CommandItem>
                <span>🏠 Home</span>
                <CommandShortcut>⌘H</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>📊 Dashboard</span>
                <CommandShortcut>⌘D</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>👥 Users</span>
                <CommandShortcut>⌘U</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>⚙️ Settings</span>
                <CommandShortcut>⌘,</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Tools" hidden={false}>
              <CommandItem>
                <span>🔍 Search</span>
                <CommandShortcut>⌘K</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>📝 Notes</span>
                <CommandShortcut>⌘⇧N</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <span>💬 Chat</span>
                <CommandShortcut>⌘⇧C</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  </div>
);

export const BasicCommand = () => (
  <div className="w-full max-w-sm rounded-lg border border-neutral-gray3">
    <Command>
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions" hidden={false}>
          <CommandItem>New File</CommandItem>
          <CommandItem>Open File</CommandItem>
          <CommandItem>Save File</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);

export const WithShortcuts = () => (
  <div className="w-full max-w-sm rounded-lg border border-neutral-gray3">
    <Command>
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="File" hidden={false}>
          <CommandItem>
            <span>New</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Open</span>
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Save</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Edit" hidden={false}>
          <CommandItem>
            <span>Undo</span>
            <CommandShortcut>⌘Z</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Redo</span>
            <CommandShortcut>⌘Y</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Cut</span>
            <CommandShortcut>⌘X</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Copy</span>
            <CommandShortcut>⌘C</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>Paste</span>
            <CommandShortcut>⌘V</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);

export const MultipleGroups = () => (
  <div className="w-full max-w-sm rounded-lg border border-neutral-gray3">
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions" hidden={false}>
          <CommandItem>
            <span>📝 New Note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>📞 Call</span>
            <CommandShortcut>⌘⇧C</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>📧 Email</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation" hidden={false}>
          <CommandItem>
            <span>🏠 Home</span>
          </CommandItem>
          <CommandItem>
            <span>📊 Analytics</span>
          </CommandItem>
          <CommandItem>
            <span>👥 Team</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="System" hidden={false}>
          <CommandItem>
            <span>⚙️ Preferences</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <span>🔒 Security</span>
          </CommandItem>
          <CommandItem>
            <span>💾 Backup</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);

export const WithIcons = () => (
  <div className="w-full max-w-sm rounded-lg border border-neutral-gray3">
    <Command>
      <CommandInput placeholder="Search actions..." />
      <CommandList>
        <CommandEmpty>No actions found.</CommandEmpty>
        <CommandGroup heading="Document" hidden={false}>
          <CommandItem>
            <div className="flex items-center gap-2">
              <span>📄</span>
              <span>Create Document</span>
            </div>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <div className="flex items-center gap-2">
              <span>📊</span>
              <span>Create Spreadsheet</span>
            </div>
            <CommandShortcut>⌘⇧N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <div className="flex items-center gap-2">
              <span>🖼️</span>
              <span>Upload Image</span>
            </div>
            <CommandShortcut>⌘U</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);
