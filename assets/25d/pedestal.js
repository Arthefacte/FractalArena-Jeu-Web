// Code-native industrial pedestal, shared by the six unmodified illustrations.
export function pedestalSVG(id){return `<svg class="hardware" viewBox="0 0 640 200" aria-hidden="true" focusable="false"><defs>
<linearGradient id="steel${id}" x2=".4" y2="1"><stop stop-color="#738087"/><stop offset=".24" stop-color="#394b52"/><stop offset=".55" stop-color="#27363d"/><stop offset="1" stop-color="#4a5960"/></linearGradient>
<linearGradient id="edge${id}" x2="0" y2="1"><stop stop-color="#61737b"/><stop offset=".15" stop-color="#263a43"/><stop offset="1" stop-color="#0b171e"/></linearGradient>
<pattern id="grain${id}" width="37" height="23" patternUnits="userSpaceOnUse"><path d="M2 4h12m12 5h8M10 18h20M3 21h5" stroke="#cad0c1" opacity=".09"/><path d="M18 2h10M1 12h20M28 21h8" stroke="#010e14" opacity=".28"/></pattern>
<pattern id="vents${id}" width="11" height="16" patternUnits="userSpaceOnUse"><path d="M3 2v12" stroke="#030c11" stroke-width="5"/><path d="M6 2v12" stroke="#52616a" stroke-width="1"/></pattern>
</defs>
<g fill="none" stroke-linecap="round"><path d="M113 128C15 140 16 179 80 183L164 182M512 129c110 13 113 51 43 52l-66 1" stroke="#071219" stroke-width="15"/><path d="M113 128C15 140 16 179 80 183L164 182M512 129c110 13 113 51 43 52l-66 1" stroke="#45515a" stroke-width="9"/><path d="M113 128C15 140 16 179 80 183L164 182M512 129c110 13 113 51 43 52l-66 1" stroke="#14232b" stroke-width="6" stroke-dasharray="3 4"/></g>
<path d="M28 75 116 33H524L612 75V131L524 175H116L28 131Z" fill="#101c23" stroke="#65717a" stroke-width="2"/>
<path d="M28 99 116 143H524L612 99V129L524 173H116L28 129Z" fill="url(#edge${id})" stroke="#061118" stroke-width="2"/>
<path d="M28 73 116 29H524L612 73V101L524 145H116L28 101Z" fill="url(#steel${id})" stroke="#8f9a9a" stroke-width="2"/>
<path d="M28 73 116 29H524L612 73V101L524 145H116L28 101Z" fill="url(#grain${id})"/>
<path d="M55 77 131 41H509L585 77V96L509 131H131L55 96Z" fill="#13232b" stroke="#090f14" stroke-width="5"/>
<path class="track" d="M62 78 133 45H507L578 78V94L507 127H133L62 94Z" fill="none" stroke="currentColor" stroke-width="2"/>
<path d="M83 80 146 52H494L557 80V92L494 119H146L83 92Z" fill="#25353b" stroke="#617077" stroke-width="1"/>
<path d="M83 80 146 52H494L557 80V92L494 119H146L83 92Z" fill="url(#grain${id})"/>
<g stroke="#101e25" stroke-width="3"><path d="M215 53v65M425 53v65M87 87h466"/><path d="m152 54 44 16m289-16-44 16M148 118l47-18m290 18-45-18"/></g>
<g stroke="#b3bab1" opacity=".22"><path d="m162 77 70 2m-52 24 50-5m87-30 30 3m108 30 59 2m-167 5 16 2m74-19 52-2"/></g>
<g fill="#0c1920" stroke="#8a9596" stroke-width="1.4">${[[116,42],[524,42],[45,85],[595,85],[116,131],[524,131],[235,37],[405,37]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="5" ry="2.4"/><path d="M${x-2} ${y}h4"/>`).join('')}</g>
<path d="M157 149h102v18H157Zm224 0h102v18H381Z" fill="url(#vents${id})" stroke="#0a171d"/>
<path d="M274 146h92v26h-92Z" fill="#26383f" stroke="#778585"/><path d="M285 153h70v12h-70Z" fill="#0a1920"/><path class="power" d="M293 159h54" stroke="currentColor" stroke-width="3"/>
<g fill="#485b62" stroke="#9aa29d" stroke-width=".7"><path d="m53 122 32 16v17l-32-16Zm534 0-32 16v17l32-16Z"/></g>
</svg>`}
