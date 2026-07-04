/** Built-in scope / method / equipment defaults per survey type. Org overrides: surveyOrgTemplates.js */

export const SURVEY_TYPE_TEMPLATES = {
  utility_mapping_survey: {
    scope:
      "Utility mapping survey of the agreed site extent to locate and chart buried services for design and construction planning. Deliverables as per client brief and PAS 128 classification where applicable.",
    methodology:
      "Desktop records review followed by site reconnaissance. Detection using EML/CAT and Genny in active and passive modes, supplemented by GPR where ground conditions allow. Survey control tied to OSGB36 / site grid as agreed. QA includes mark-up review and client handover briefing.",
    equipmentUsed: "RD8000 / cable locator, GPR (site-appropriate array), GNSS rover or total station, spray paint and site markers.",
  },
  gpr_survey: {
    scope: "Ground penetrating radar survey over the agreed extent to identify shallow anomalies, services and structural features.",
    methodology:
      "Grid or route-based GPR acquisition with calibrated depth scale. Data reviewed on-site for obvious anomalies; post-processing and interpretation aligned to client deliverable format.",
    equipmentUsed: "Multi-channel or single-frequency GPR, GNSS/total station for geo-referencing, processing software.",
  },
  eml_cat_survey: {
    scope: "Electromagnetic location (EML/CAT) survey to identify indicative buried services within the agreed extent.",
    methodology:
      "Systematic sweeps in Power, Radio and Genny modes where access permits. Findings marked on site and transferred to deliverable drawing; limitations of EML noted in report.",
    equipmentUsed: "CAT & Genny / RD8000 class locator, site drawing or GNSS pegging.",
  },
  topographical_survey: {
    scope: "Topographical survey of site features, levels and boundaries for design development.",
    methodology:
      "Establish control network; feature and level capture by total station or GNSS with independent checks on closed traverses or redundant observations where specified.",
    equipmentUsed: "Robotic total station, GNSS rover, data logger.",
  },
  general_site_survey: {
    scope: "General site survey and factual reporting of conditions and features within the agreed extent.",
    methodology: "Site visit, measurement and recording using methods appropriate to the brief and site constraints.",
    equipmentUsed: "As per method statement and site conditions.",
  },
  cctv_drainage_survey: {
    scope: "CCTV drainage survey of accessible drainage runs within the agreed extent to record condition, connectivity and defects.",
    methodology:
      "Access points identified on site; crawler deployed with full distance and direction logging. Footage reviewed on site for obvious defects; observations coded to client specification. Cleansing or jetting only where agreed in RAMS.",
    equipmentUsed: "CCTV crawler (mini/mainline as appropriate), winch, sonde/locator where applicable, recording unit.",
  },
  gnss_control: {
    scope: "GNSS control survey to establish or verify primary control for the project grid / OSGB36 as agreed.",
    methodology:
      "Static or RTK observations on agreed control points with redundancy checks. Post-processing against OS network or project datum; residuals recorded and issued with control schedule.",
    equipmentUsed: "Dual-frequency GNSS receiver, tribrach, control targets, processing software.",
  },
  laser_scanning: {
    scope: "Terrestrial laser scanning to capture point cloud data of the agreed extent for design, record or clash purposes.",
    methodology:
      "Scanner positions planned for coverage and overlap; targets or cloud-to-cloud registration as specified. Data registered, cleaned and issued in agreed format with survey report on accuracy and coverage gaps.",
    equipmentUsed: "Terrestrial laser scanner, targets, GNSS/total station for registration, point cloud software.",
  },
  uav_aerial: {
    scope: "UAV aerial survey / photogrammetry over the agreed site extent for orthoimagery, DSM or volumetric deliverables.",
    methodology:
      "Pre-flight checks, NOTAM/airspace review and RAMS brief. Ground control or RTK PPK as specified; flight lines and overlap per client spec. Processing QA on GCP residuals and coverage.",
    equipmentUsed: "UAV platform, RTK/PPK module, ground control targets, photogrammetry software.",
  },
  setting_out: {
    scope: "Engineering setting out of design elements from issued drawings within the agreed tolerance and hold points.",
    methodology:
      "Control verified from project grid; setting out from latest revision drawings with independent check on critical points. As-built dimensions recorded and issued on completion sheets.",
    equipmentUsed: "Robotic total station or GNSS rover, design drawings, setting-out record sheets.",
  },
  site_investigation_campaign: {
    scope:
      "Ground investigation campaign over the agreed extent — trial pits, window sampling, dynamic probing, boreholes, in-situ testing and monitoring wells — to inform geotechnical and environmental design.",
    methodology:
      "Desk study and contamination/gas assessment reviewed before mobilisation. Intrusive methods executed in agreed sequence with permit-to-dig and ground disturbance controls. Samples logged with chain of custody; boreholes abandoned or monitoring wells installed per specification. Factual logs and sample register issued for interpretation.",
    equipmentUsed:
      "Window sampler / mini excavator, DCP/dynamic probe kit, drilling rig (cable percussive/rotary as specified), hand auger, U100/piston samplers, gas monitor, sample tubes and chain-of-custody forms.",
  },
};
