import * as React from "react"

import { cn } from "@/lib/utils"
import "./table-cards.css"

// Opt-in responsive "card" mode: pass `cards` to <Table> and on small screens each
// row renders as a labeled card (label taken from the column header) instead of an
// overflowing/squished row. Desktop is unchanged. Tables WITHOUT the prop are untouched.
const TableCardCtx = React.createContext({ enabled: false, labels: [] })
const InBodyCtx = React.createContext(false)

function nodeText(node) {
  if (node == null || node === false || node === true) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join("")
  if (React.isValidElement(node)) return nodeText(node.props?.children)
  return ""
}

// header labels: first TableRow inside TableHeader -> each TableHead's text, in order
function extractLabels(children) {
  let labels = []
  React.Children.forEach(children, (child) => {
    if (labels.length || !React.isValidElement(child)) return
    if (child.type?.displayName === "TableHeader") {
      React.Children.forEach(child.props.children, (row) => {
        if (labels.length || !React.isValidElement(row)) return
        labels = React.Children.toArray(row.props.children)
          .filter(React.isValidElement)
          .map((h) => nodeText(h.props?.children).trim())
      })
    }
  })
  return labels
}

const Table = React.forwardRef(({ className, cards = false, children, ...props }, ref) => {
  const labels = React.useMemo(() => (cards ? extractLabels(children) : []), [cards, children])
  const ctx = React.useMemo(() => ({ enabled: cards, labels }), [cards, labels])
  return (
    <TableCardCtx.Provider value={ctx}>
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn("w-full caption-bottom text-sm", cards && "tbl-cards", className)}
          {...props}>
          {children}
        </table>
      </div>
    </TableCardCtx.Provider>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-secondary/40 [&_tr]:border-b [&_tr]:border-border/70", className)}
    {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <InBodyCtx.Provider value={true}>
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props} />
  </InBodyCtx.Provider>
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t border-border/70 bg-secondary/40 font-medium [&>tr]:last:border-b-0", className)}
    {...props} />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef(({ className, children, ...props }, ref) => {
  const { enabled, labels } = React.useContext(TableCardCtx)
  const inBody = React.useContext(InBodyCtx)
  let kids = children
  // In card mode, stamp each body cell with its column label (for the CSS ::before),
  // unless it's a full-width colSpan cell (empty-state / message row).
  if (enabled && inBody && labels.length) {
    let i = 0
    kids = React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) return child
      if (child.props?.colSpan) return child
      const label = labels[i] ?? ""
      i += 1
      return child.props?.["data-label"] != null
        ? child
        : React.cloneElement(child, { "data-label": label })
    })
  }
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/60 transition-colors duration-150 hover:bg-secondary/40 data-[state=selected]:bg-secondary",
        className
      )}
      {...props}>
      {kids}
    </tr>
  )
})
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-3 text-left align-middle font-medium text-muted-foreground text-[11px] uppercase tracking-wider [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-3 align-middle text-sm [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props} />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props} />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
