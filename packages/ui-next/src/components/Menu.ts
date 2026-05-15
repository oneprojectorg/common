// Pure re-export of shadcn's DropdownMenu primitives. No compat layer.
//
// Usage:
//   <DropdownMenu>
//     <DropdownMenuTrigger asChild><Button>Open</Button></DropdownMenuTrigger>
//     <DropdownMenuContent align="end">
//       <DropdownMenuItem onClick={...}>Action</DropdownMenuItem>
//       <DropdownMenuSeparator />
//       <DropdownMenuLabel>Section</DropdownMenuLabel>
//       <DropdownMenuItem>Another</DropdownMenuItem>
//     </DropdownMenuContent>
//   </DropdownMenu>

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './ui/dropdown-menu';
