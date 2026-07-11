/** Built-in method statement step sequences — shared by MS editor, playbooks and org overrides. */

export const MS_STEP_TEMPLATES = {
  mobilisation: [
    "Arrive on site, sign in and complete site induction",
    "Undertake site survey and identify any hazards in the work area",
    "Set up compound/exclusion zone and erect appropriate signage",
    "Issue permits to work and confirm isolation procedures with site manager",
    "Brief all operatives on the method statement and RAMS before works commence",
  ],
  electrical: [
    "Isolate electrical supply to work area and apply lock-off device",
    "Test with approved voltage indicator to confirm circuit is dead (GS38)",
    "Install warning notices at isolation point",
    "Carry out work in accordance with BS 7671",
    "Test installation on completion before re-energising",
    "Re-energise supply under supervision and confirm correct operation",
  ],
  mechanical: [
    "Confirm isolation of all services (electric, gas, water, steam) to work area",
    "Apply LOTO (lock-out tag-out) to all energy isolation points",
    "Drain down pipework and confirm system is pressure-free",
    "Carry out mechanical works in accordance with design drawings",
    "Pressure test pipework/system on completion; record test pressure and duration",
    "Remove LOTO devices and restore services; confirm with site manager",
  ],
  height: [
    "Erect and inspect access equipment (scaffold/MEWP) before use",
    "Issue MEWP daily check sheet; record any defects",
    "Brief operatives on exclusion zone and falling object precautions",
    "Fit harness and connect to anchor point before leaving platform",
    "Carry out work; lower all tools and materials in controlled manner",
    "Dismantle access equipment; inspect for damage before storage",
  ],
  demobilisation: [
    "Clear all waste materials and redundant equipment from work area",
    "Clean work area to at least the same standard as found",
    "Complete all as-built drawings and test/inspection records",
    "Obtain sign-off from site manager / client representative",
    "Return all permits and confirm systems restored to normal operation",
    "Remove site compound; confirm all consumables correctly disposed",
  ],
  foodFactoryMobilisation: [
    "Arrive on site, sign in, wash hands and sanitise",
    "Change into site-required PPE and complete hygiene checks",
    "Review RAMS and method statement; confirm permit issued and work area shown",
    "Secure the work area and prevent unauthorised access or vehicle movements",
    "Carry out works within the controlled or high-care zone under supervisor control",
    "Complete close-out checks, sign off permit, and hand back to site management",
  ],
};

export const MS_TEMPLATE_DEFS = [
  { key: "mobilisation", label: "Mobilisation sequence" },
  { key: "foodFactoryMobilisation", label: "Food factory mobilisation" },
  { key: "electrical", label: "Electrical isolation sequence" },
  { key: "mechanical", label: "Mechanical LOTO sequence" },
  { key: "height", label: "Work at height sequence" },
  { key: "demobilisation", label: "Demobilisation sequence" },
];
