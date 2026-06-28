import SimpleFormDialog from "../../../components/SimpleFormDialog";

/** @deprecated Use SimpleFormDialog directly — kept for permits module imports. */
export default function PermitSimpleFormDialog(props) {
  return <SimpleFormDialog {...props} />;
}

export { permitDialogStyles } from "./PermitDialogShell";
