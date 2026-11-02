/*
 * TaskDragon card + panel for Home Assistant.
 *
 * Zero-dependency Web Components (no build step): <taskdragon-card> for Lovelace,
 * <taskdragon-panel> for the sidebar and <taskdragon-card-editor> for the visual
 * card editor. All data comes from the taskdragon/* WebSocket API; a
 * taskdragon/subscribe subscription keeps every open dashboard live.
 *
 * Rendering is escape-by-default, the same model as Lit: markup is only ever
 * produced by the `html` tagged template, which HTML-escapes every interpolated
 * value unless it is itself an `html` result. `setHTML` refuses anything else
 * and runs an allow-list sanitizer over the parsed (inert) template before it
 * reaches the live DOM, so task names, notes or Mealie recipe titles can never
 * inject markup or script into the dashboard.
 */

const TD_VERSION = "1.5.0";

/* The TaskDragon emblem (an ouroboros dragon) as a Home Assistant icon set, so
 * `taskdragon:dragon` works in the sidebar, in <ha-icon> and in this card. */
const TD_DRAGON_PATH = "M337.8 72.4 L339.3 73.1 L340.9 73.9 L342.5 74.7 L344.1 75.5 L345.6 76.3 L347.2 77.1 L348.7 77.9 L350.2 78.8 L351.8 79.6 L353.3 80.5 L354.8 81.4 L356.3 82.3 L357.8 83.2 L359.3 84.1 L360.7 85.1 L362.2 86.0 L363.7 87.0 L365.1 88.0 L366.6 88.9 L368.0 89.9 L369.4 91.0 L370.8 92.0 L372.3 93.0 L373.7 94.1 L375.0 95.1 L376.4 96.2 L379.7 94.8 L382.9 93.6 L386.0 92.6 L389.1 91.6 L392.1 90.9 L395.1 90.2 L398.0 89.7 L400.9 89.4 L403.6 89.1 L406.3 89.1 L408.9 89.1 L411.4 89.4 L413.8 89.7 L416.1 90.2 L418.3 90.8 L420.4 91.6 L422.4 92.5 L424.2 93.6 L425.9 94.8 L427.3 96.2 L422.2 103.7 L417.7 110.4 L413.9 116.3 L410.9 121.3 L409.0 125.3 L408.6 128.0 L409.7 129.3 L410.7 130.7 L414.1 130.2 L417.5 129.9 L420.7 129.6 L423.9 129.5 L427.0 129.5 L429.9 129.6 L432.8 129.9 L435.6 130.2 L438.3 130.7 L440.9 131.3 L443.3 132.0 L445.7 132.8 L447.9 133.8 L450.0 134.8 L451.9 136.0 L453.7 137.2 L455.4 138.6 L456.8 140.0 L458.2 141.6 L459.2 143.3 L452.6 149.2 L446.8 154.6 L441.8 159.3 L437.9 163.3 L435.1 166.7 L434.1 169.1 L434.8 170.7 L435.5 172.3 L438.9 172.7 L442.1 173.1 L445.3 173.7 L448.3 174.4 L451.2 175.1 L454.0 176.0 L456.7 176.9 L459.2 178.0 L461.7 179.1 L464.0 180.3 L466.1 181.6 L468.2 182.9 L470.1 184.4 L471.8 185.9 L473.4 187.5 L474.8 189.1 L476.0 190.8 L477.1 192.6 L478.0 194.4 L478.6 196.4 L471.0 200.4 L464.2 204.1 L458.4 207.4 L453.7 210.3 L450.4 212.9 L448.9 215.0 L449.2 216.7 L449.5 218.4 L452.6 219.6 L455.5 220.8 L458.3 222.1 L461.0 223.5 L463.6 225.0 L466.0 226.5 L468.4 228.0 L470.5 229.7 L472.6 231.3 L474.5 233.0 L476.2 234.8 L477.8 236.6 L479.2 238.4 L480.5 240.3 L481.6 242.2 L482.6 244.1 L483.4 246.1 L483.9 248.0 L484.3 250.0 L484.5 252.0 L476.3 254.1 L469.1 256.0 L462.9 257.8 L457.7 259.5 L454.0 261.2 L452.0 262.8 L451.9 264.6 L451.8 266.3 L454.4 268.1 L456.9 270.0 L459.3 272.0 L461.5 274.0 L463.6 276.0 L465.5 278.0 L467.3 280.1 L469.0 282.1 L470.5 284.2 L471.8 286.3 L473.1 288.4 L474.1 290.6 L475.1 292.7 L475.8 294.8 L476.4 296.9 L476.9 298.9 L477.1 301.0 L477.2 303.0 L477.1 305.0 L476.8 307.0 L468.6 307.0 L461.3 307.2 L455.0 307.5 L449.8 307.9 L445.8 308.6 L443.6 309.8 L443.1 311.4 L442.5 313.0 L444.5 315.4 L446.4 317.9 L448.2 320.3 L449.8 322.7 L451.2 325.1 L452.6 327.5 L453.8 329.9 L454.8 332.3 L455.7 334.7 L456.5 337.0 L457.2 339.3 L457.7 341.6 L458.0 343.8 L458.2 346.0 L458.3 348.2 L458.2 350.3 L457.9 352.3 L457.5 354.3 L456.9 356.2 L456.1 358.0 L448.4 356.2 L441.5 354.6 L435.5 353.4 L430.4 352.7 L426.5 352.4 L424.1 353.1 L423.2 354.5 L422.3 355.9 L423.4 358.6 L424.4 361.3 L425.3 363.9 L426.1 366.5 L426.7 369.0 L427.3 371.5 L427.7 374.0 L428.0 376.4 L428.2 378.8 L428.2 381.1 L428.2 383.4 L428.0 385.6 L427.7 387.8 L427.3 389.8 L426.8 391.8 L426.1 393.8 L425.4 395.6 L424.5 397.4 L423.4 399.0 L422.2 400.5 L415.8 397.4 L410.1 394.7 L405.0 392.5 L400.7 390.9 L397.2 390.0 L394.9 390.1 L393.7 391.3 L392.5 392.5 L392.9 395.3 L393.1 398.0 L393.3 400.7 L393.4 403.3 L393.4 405.9 L393.3 408.4 L393.0 410.9 L392.7 413.3 L392.3 415.6 L391.8 417.8 L391.1 419.9 L390.4 422.0 L389.6 424.0 L388.7 425.9 L387.7 427.6 L386.6 429.3 L385.4 430.9 L384.1 432.4 L382.7 433.7 L381.2 434.8 L375.9 430.5 L371.1 426.6 L366.8 423.4 L363.1 420.9 L360.0 419.2 L357.8 418.8 L356.3 419.7 L354.9 420.5 L354.5 423.3 L354.1 425.9 L353.6 428.5 L353.0 431.0 L352.4 433.5 L351.6 435.8 L350.8 438.1 L349.9 440.2 L348.9 442.3 L347.8 444.3 L346.7 446.2 L345.5 448.0 L344.3 449.7 L342.9 451.2 L341.5 452.7 L340.1 454.0 L338.5 455.2 L336.9 456.3 L335.3 457.2 L333.5 458.0 L329.5 452.7 L325.9 447.9 L322.6 443.9 L319.6 440.7 L317.1 438.5 L315.0 437.6 L313.4 438.1 L311.8 438.5 L310.8 441.0 L309.7 443.4 L308.6 445.8 L307.4 448.0 L306.2 450.1 L304.9 452.1 L303.6 454.1 L302.2 455.9 L300.7 457.6 L299.2 459.3 L297.7 460.8 L296.1 462.2 L294.4 463.4 L292.8 464.6 L291.1 465.7 L289.4 466.6 L287.6 467.3 L285.8 468.0 L284.0 468.5 L282.1 468.8 L279.6 462.9 L277.2 457.6 L275.0 453.1 L272.9 449.4 L271.0 446.7 L269.2 445.4 L267.6 445.5 L265.9 445.5 L264.4 447.6 L262.8 449.6 L261.1 451.5 L259.4 453.3 L257.7 455.0 L256.0 456.6 L254.2 458.1 L252.4 459.5 L250.6 460.8 L248.8 461.9 L247.0 463.0 L245.1 463.9 L243.2 464.7 L241.4 465.4 L239.5 466.0 L237.6 466.4 L235.7 466.7 L233.8 466.9 L232.0 466.9 L230.1 466.8 L229.1 460.7 L228.0 455.2 L226.9 450.4 L225.8 446.5 L224.6 443.5 L223.2 441.9 L221.6 441.6 L220.0 441.2 L218.0 442.8 L216.0 444.3 L214.0 445.7 L211.9 446.9 L209.9 448.1 L207.8 449.2 L205.8 450.1 L203.8 451.0 L201.7 451.7 L199.7 452.4 L197.7 452.9 L195.7 453.3 L193.7 453.6 L191.7 453.8 L189.8 453.9 L187.9 453.8 L186.0 453.7 L184.2 453.4 L182.4 452.9 L180.6 452.4 L181.0 446.4 L181.2 441.0 L181.3 436.3 L181.1 432.4 L180.6 429.3 L179.7 427.4 L178.2 426.7 L176.7 426.0 L174.4 427.0 L172.2 427.9 L169.9 428.6 L167.7 429.3 L165.5 429.9 L163.3 430.4 L161.1 430.8 L159.0 431.1 L156.8 431.3 L154.8 431.4 L152.7 431.4 L150.7 431.2 L148.7 431.0 L146.8 430.7 L144.9 430.3 L143.1 429.8 L141.4 429.2 L139.7 428.4 L138.1 427.6 L136.6 426.6 L138.2 421.1 L139.7 416.1 L140.8 411.7 L141.5 408.0 L141.7 405.0 L141.2 403.0 L139.9 402.0 L138.7 400.9 L136.3 401.2 L133.9 401.5 L131.6 401.6 L129.3 401.7 L127.1 401.7 L124.9 401.6 L122.8 401.4 L120.7 401.1 L118.6 400.8 L116.6 400.3 L114.7 399.8 L112.8 399.2 L111.0 398.5 L109.2 397.7 L107.5 396.9 L105.9 395.9 L104.4 394.9 L103.0 393.8 L101.6 392.6 L100.4 391.2 L103.2 386.5 L105.6 382.2 L107.6 378.3 L109.1 374.9 L110.0 372.2 L109.9 370.1 L109.0 368.8 L108.0 367.5 L105.7 367.2 L103.4 366.9 L101.2 366.4 L99.1 365.9 L97.0 365.3 L94.9 364.7 L92.9 363.9 L91.0 363.1 L89.2 362.3 L87.4 361.3 L85.7 360.4 L84.1 359.3 L82.5 358.2 L81.1 357.0 L79.7 355.8 L78.4 354.5 L77.2 353.1 L76.1 351.7 L75.1 350.2 L74.2 348.6 L77.9 344.8 L81.1 341.3 L83.8 338.1 L85.9 335.3 L87.3 332.9 L87.7 330.9 L87.1 329.4 L86.5 327.9 L84.4 327.1 L82.4 326.1 L80.4 325.2 L78.5 324.1 L76.7 323.0 L75.0 321.9 L73.3 320.7 L71.7 319.5 L70.2 318.2 L68.7 316.8 L67.4 315.5 L66.1 314.1 L64.9 312.6 L63.8 311.1 L62.8 309.6 L61.9 308.0 L61.1 306.4 L60.4 304.8 L59.8 303.1 L59.4 301.4 L63.6 298.6 L67.4 296.1 L70.6 293.7 L73.1 291.5 L75.0 289.5 L75.8 287.8 L75.6 286.2 L75.3 284.6 L73.6 283.3 L72.0 281.9 L70.4 280.4 L68.9 279.0 L67.5 277.5 L66.1 276.0 L64.9 274.4 L63.7 272.8 L62.6 271.2 L61.5 269.6 L60.6 268.0 L59.8 266.3 L59.0 264.6 L58.4 262.9 L57.8 261.2 L57.3 259.5 L57.0 257.7 L56.7 256.0 L56.5 254.3 L56.5 252.5 L61.0 250.9 L65.0 249.3 L68.5 247.8 L71.4 246.3 L73.5 244.8 L74.7 243.3 L74.9 241.7 L75.0 240.2 L73.8 238.5 L72.6 236.7 L71.5 235.0 L70.5 233.2 L69.5 231.5 L68.7 229.7 L67.9 227.9 L67.2 226.1 L66.6 224.3 L66.0 222.5 L65.6 220.7 L65.2 218.9 L64.9 217.1 L64.7 215.3 L64.6 213.6 L64.6 211.8 L64.7 210.1 L64.9 208.3 L65.2 206.6 L65.6 205.0 L70.1 204.4 L74.1 203.8 L77.7 203.2 L80.6 202.4 L83.0 201.4 L84.4 200.2 L84.9 198.8 L85.5 197.3 L84.8 195.4 L84.1 193.4 L83.6 191.5 L83.1 189.6 L82.7 187.7 L82.3 185.8 L82.1 184.0 L81.9 182.1 L81.8 180.2 L81.7 178.4 L81.8 176.6 L81.9 174.8 L82.1 173.0 L82.3 171.3 L82.7 169.6 L83.1 167.9 L83.6 166.3 L84.3 164.7 L84.9 163.1 L85.7 161.6 L90.0 162.1 L93.8 162.4 L97.2 162.5 L100.1 162.4 L102.5 161.9 L104.1 161.1 L105.0 159.8 L105.9 158.5 L105.8 156.6 L105.7 154.6 L105.7 152.7 L105.7 150.8 L105.9 148.9 L106.1 147.1 L106.3 145.2 L106.6 143.4 L107.0 141.7 L107.5 140.0 L108.0 138.3 L108.6 136.6 L109.2 135.0 L109.9 133.4 L110.7 131.9 L111.5 130.4 L112.4 129.0 L113.4 127.6 L114.5 126.3 L115.6 125.1 L119.4 126.3 L122.8 127.4 L125.9 128.1 L128.6 128.6 L130.9 128.7 L132.6 128.2 L133.8 127.2 L135.0 126.2 L136.1 125.2 L137.3 124.2 L138.5 123.2 L139.7 122.2 L140.9 121.3 L142.1 120.3 L143.4 119.4 L144.6 118.4 L145.8 117.5 L147.1 116.6 L148.4 115.7 L149.6 114.8 L150.9 114.0 L152.2 113.1 L153.5 112.3 L154.8 111.4 L156.1 110.6 L157.4 109.8 L158.7 109.0 L160.0 108.2 L161.4 107.5 L162.7 106.7 L164.1 106.1 L165.6 105.5 L167.0 104.9 L168.4 104.3 L169.8 103.7 L171.3 103.2 L172.7 102.6 L174.2 102.1 L175.6 101.5 L177.0 101.0 L178.5 100.5 L179.9 100.1 L181.4 99.6 L182.9 99.1 L184.3 98.7 L185.8 98.3 L187.2 97.8 L188.7 97.4 L190.2 97.1 L191.6 96.7 L193.1 96.3 L194.6 96.0 L196.0 95.6 L197.5 95.3 L199.0 95.0 L200.5 94.7 L201.9 94.4 L203.4 94.2 L204.9 93.9 L206.4 93.7 L207.8 93.4 L209.3 93.2 L210.8 93.0 L212.3 92.8 L213.8 92.7 L215.2 92.5 L216.7 92.4 L218.2 92.2 L219.7 92.1 L221.1 92.0 L222.6 91.9 L224.1 91.8 L225.6 91.8 L227.0 91.7 L228.5 91.7 L230.0 91.6 L231.4 91.6 L232.9 91.6 L232.9 91.6 L231.5 92.0 L230.1 92.5 L228.7 92.9 L227.3 93.3 L225.9 93.8 L224.6 94.3 L223.2 94.8 L221.8 95.3 L220.5 95.8 L219.1 96.3 L217.8 96.8 L216.4 97.4 L215.1 97.9 L213.8 98.5 L212.5 99.0 L211.2 99.6 L209.9 100.2 L208.6 100.8 L207.3 101.5 L206.0 102.1 L204.7 102.7 L203.4 103.4 L202.2 104.0 L200.9 104.7 L199.7 105.4 L198.5 106.1 L197.2 106.8 L196.0 107.5 L194.8 108.2 L193.6 108.9 L192.4 109.7 L191.2 110.4 L190.0 111.2 L188.8 112.0 L187.7 112.8 L186.5 113.5 L185.4 114.3 L184.2 115.1 L183.1 116.0 L182.0 116.8 L180.9 117.6 L179.8 118.5 L178.7 119.3 L177.6 120.2 L176.5 121.0 L175.4 121.9 L174.4 122.8 L173.3 123.7 L172.2 124.5 L171.1 125.3 L170.0 126.1 L169.0 127.0 L167.9 127.8 L166.8 128.6 L165.7 129.5 L164.7 130.3 L163.6 131.2 L162.6 132.0 L161.5 132.9 L161.2 134.7 L160.0 135.3 L158.8 135.9 L157.5 136.5 L156.1 137.0 L154.8 137.5 L153.4 138.0 L152.8 139.4 L152.2 140.7 L151.6 142.0 L150.9 143.3 L150.3 144.6 L149.6 145.8 L148.8 146.9 L148.0 148.0 L147.1 149.0 L146.2 150.0 L145.2 150.9 L144.2 151.7 L143.1 152.5 L141.9 153.3 L140.7 154.0 L139.5 154.7 L138.3 155.4 L137.0 156.2 L136.6 157.6 L136.2 159.0 L135.8 160.4 L135.4 161.8 L134.9 163.1 L134.4 164.4 L133.8 165.6 L133.2 166.8 L132.5 167.9 L131.8 169.0 L130.9 170.0 L130.0 171.0 L129.1 172.0 L128.1 172.9 L127.0 173.8 L125.9 174.7 L124.8 175.6 L123.6 176.5 L123.5 177.9 L123.3 179.4 L123.1 180.8 L122.9 182.2 L122.7 183.6 L122.4 185.0 L122.0 186.3 L121.6 187.5 L121.1 188.7 L120.5 189.9 L119.8 191.1 L119.1 192.2 L118.3 193.3 L117.5 194.3 L116.5 195.4 L115.6 196.4 L114.6 197.4 L113.7 198.5 L113.7 200.0 L113.8 201.4 L113.8 202.8 L113.8 204.3 L113.8 205.7 L113.7 207.0 L113.6 208.3 L113.4 209.7 L113.0 210.9 L112.7 212.2 L112.2 213.4 L111.6 214.6 L111.0 215.8 L110.3 217.0 L109.6 218.1 L108.8 219.3 L108.0 220.5 L107.2 221.7 L107.5 223.1 L107.8 224.5 L108.1 225.9 L108.3 227.3 L108.5 228.7 L108.7 230.0 L108.7 231.4 L108.7 232.7 L108.6 234.0 L108.4 235.3 L108.1 236.5 L107.8 237.8 L107.3 239.1 L106.9 240.3 L106.3 241.6 L105.7 242.9 L105.1 244.1 L104.5 245.4 L105.0 246.8 L105.5 248.1 L106.0 249.5 L106.5 250.8 L106.9 252.1 L107.2 253.4 L107.5 254.7 L107.7 256.0 L107.8 257.3 L107.8 258.6 L107.7 259.9 L107.6 261.2 L107.3 262.5 L107.0 263.8 L106.7 265.1 L106.3 266.5 L105.9 267.8 L105.5 269.2 L106.3 270.4 L107.0 271.7 L107.7 272.9 L108.3 274.1 L108.9 275.4 L109.4 276.6 L109.9 277.8 L110.3 279.1 L110.6 280.3 L110.8 281.6 L110.9 282.9 L111.0 284.2 L111.0 285.5 L110.9 286.8 L110.7 288.2 L110.6 289.6 L110.4 291.0 L110.2 292.3 L111.1 293.5 L112.0 294.6 L112.9 295.7 L113.7 296.8 L114.5 297.9 L115.2 299.0 L115.9 300.2 L116.4 301.3 L116.9 302.5 L117.3 303.8 L117.6 305.0 L117.9 306.3 L118.1 307.6 L118.2 308.9 L118.3 310.2 L118.3 311.6 L118.4 313.0 L118.4 314.4 L119.5 315.4 L120.5 316.3 L121.6 317.3 L122.5 318.2 L123.5 319.2 L124.4 320.2 L125.2 321.2 L125.9 322.3 L126.6 323.4 L127.2 324.5 L127.7 325.7 L128.1 326.9 L128.5 328.1 L128.8 329.4 L129.1 330.7 L129.4 332.1 L129.6 333.4 L129.9 334.8 L131.1 335.6 L132.3 336.4 L133.4 337.1 L134.6 337.9 L135.6 338.7 L136.7 339.6 L137.6 340.4 L138.5 341.4 L139.3 342.3 L140.1 343.4 L140.8 344.4 L141.4 345.5 L142.0 346.7 L142.5 347.9 L143.0 349.2 L143.4 350.5 L143.9 351.8 L144.3 353.1 L145.6 353.6 L146.9 354.2 L148.2 354.8 L149.4 355.4 L150.6 356.0 L151.7 356.7 L152.8 357.4 L153.8 358.2 L154.8 359.0 L155.7 359.9 L156.5 360.8 L157.3 361.8 L158.1 362.9 L158.8 364.0 L159.4 365.2 L160.1 366.3 L160.7 367.6 L161.4 368.8 L162.7 369.1 L164.1 369.5 L165.4 369.9 L166.7 370.3 L168.0 370.7 L169.2 371.2 L170.4 371.7 L171.5 372.3 L172.6 373.0 L173.6 373.7 L174.6 374.5 L175.5 375.4 L176.4 376.3 L177.2 377.3 L178.1 378.3 L178.9 379.4 L179.7 380.5 L180.5 381.6 L181.9 381.7 L183.3 381.9 L184.7 382.0 L186.1 382.2 L187.4 382.4 L188.6 382.7 L189.9 383.0 L191.1 383.4 L192.2 383.9 L193.3 384.5 L194.4 385.1 L195.5 385.8 L196.5 386.6 L197.5 387.4 L198.5 388.3 L199.4 389.3 L200.4 390.2 L201.4 391.2 L202.8 391.1 L204.2 391.0 L205.6 390.9 L206.9 390.9 L208.2 390.9 L209.5 391.0 L210.8 391.1 L212.0 391.3 L213.2 391.6 L214.4 392.0 L215.6 392.5 L216.7 393.0 L217.8 393.6 L218.9 394.3 L220.1 395.0 L221.2 395.8 L222.3 396.6 L223.4 397.3 L224.7 397.0 L226.1 396.7 L227.4 396.5 L228.7 396.2 L230.0 396.0 L231.3 395.9 L232.6 395.8 L233.8 395.9 L235.1 396.0 L236.3 396.1 L237.5 396.4 L238.7 396.8 L239.9 397.2 L241.1 397.7 L242.3 398.2 L243.5 398.8 L244.7 399.4 L245.9 400.0 L247.2 399.5 L248.5 399.0 L249.8 398.5 L251.0 398.1 L252.3 397.7 L253.5 397.3 L254.8 397.1 L256.0 396.9 L257.2 396.8 L258.5 396.8 L259.7 396.9 L260.9 397.0 L262.2 397.3 L263.4 397.6 L264.7 397.9 L265.9 398.3 L267.2 398.7 L268.5 399.1 L269.7 398.4 L270.9 397.7 L272.1 397.0 L273.2 396.4 L274.4 395.8 L275.6 395.3 L276.7 394.8 L277.9 394.5 L279.1 394.2 L280.3 394.0 L281.6 393.9 L282.8 393.8 L284.1 393.9 L285.3 394.0 L286.6 394.1 L287.9 394.3 L289.3 394.5 L290.6 394.7 L291.6 393.8 L292.7 393.0 L293.7 392.1 L294.8 391.3 L295.9 390.5 L296.9 389.8 L298.0 389.2 L299.1 388.7 L300.2 388.2 L301.4 387.8 L302.6 387.5 L303.8 387.3 L305.0 387.1 L306.3 387.0 L307.6 387.0 L308.9 387.0 L310.2 387.0 L311.6 387.0 L312.5 385.9 L313.4 384.9 L314.3 383.9 L315.2 382.9 L316.1 382.0 L317.1 381.2 L318.0 380.4 L319.0 379.7 L320.1 379.1 L321.1 378.5 L322.3 378.0 L323.4 377.6 L324.6 377.3 L325.8 377.0 L327.1 376.7 L328.4 376.5 L329.7 376.3 L331.0 376.1 L331.8 374.9 L332.5 373.8 L333.2 372.6 L333.9 371.6 L334.7 370.5 L335.5 369.5 L336.3 368.6 L337.2 367.8 L338.1 367.0 L339.1 366.3 L340.1 365.6 L341.2 365.0 L342.3 364.5 L343.5 364.0 L344.7 363.6 L345.9 363.2 L347.2 362.8 L348.4 362.3 L349.0 361.1 L349.5 359.8 L350.0 358.6 L350.6 357.4 L351.2 356.3 L351.8 355.2 L352.5 354.2 L353.2 353.2 L354.0 352.3 L354.8 351.4 L355.7 350.6 L356.7 349.9 L357.7 349.2 L358.8 348.6 L359.9 347.9 L361.1 347.3 L362.2 346.7 L363.4 346.1 L363.8 344.8 L364.1 343.5 L364.4 342.2 L364.8 341.0 L365.2 339.8 L365.6 338.6 L366.1 337.5 L366.7 336.4 L367.3 335.4 L368.0 334.4 L368.8 333.5 L369.6 332.6 L370.5 331.8 L371.4 331.0 L372.5 330.2 L373.5 329.4 L374.6 328.7 L375.6 327.9 L375.7 326.5 L375.9 325.2 L376.0 323.9 L376.1 322.6 L376.3 321.3 L376.6 320.1 L376.9 318.9 L377.3 317.8 L377.7 316.7 L378.3 315.6 L378.9 314.6 L379.6 313.6 L380.3 312.7 L381.1 311.7 L382.0 310.8 L382.9 309.9 L383.8 309.0 L384.8 308.0 L384.7 306.7 L384.6 305.4 L384.5 304.0 L384.5 302.8 L384.5 301.5 L384.5 300.2 L384.6 299.0 L384.8 297.9 L385.1 296.7 L385.5 295.6 L385.9 294.5 L386.4 293.4 L387.0 292.3 L387.7 291.3 L388.4 290.2 L389.1 289.2 L389.9 288.2 L390.7 287.1 L390.4 285.8 L390.1 284.5 L389.8 283.2 L389.5 282.0 L389.3 280.7 L389.2 279.5 L389.1 278.3 L389.1 277.1 L389.2 275.9 L389.4 274.8 L389.7 273.6 L390.0 272.5 L390.4 271.3 L390.9 270.2 L391.5 269.0 L392.0 267.9 L392.6 266.8 L393.3 265.6 L392.7 264.4 L392.2 263.1 L391.7 261.9 L391.3 260.7 L390.9 259.5 L390.6 258.3 L390.3 257.2 L390.1 256.0 L390.1 254.8 L390.1 253.7 L390.1 252.5 L390.3 251.3 L390.5 250.1 L390.8 248.9 L391.2 247.7 L391.6 246.5 L392.0 245.3 L392.4 244.1 L391.7 242.9 L391.0 241.8 L390.4 240.7 L389.7 239.6 L389.2 238.5 L388.6 237.4 L388.2 236.2 L387.8 235.1 L387.6 234.0 L387.4 232.8 L387.3 231.7 L387.3 230.5 L387.3 229.3 L387.4 228.1 L387.6 226.8 L387.8 225.6 L388.0 224.3 L388.2 223.0 L387.4 222.0 L386.5 221.0 L385.7 220.0 L384.9 219.0 L384.2 218.0 L383.5 217.0 L382.9 216.0 L382.3 214.9 L381.9 213.9 L381.5 212.8 L381.3 211.6 L381.1 210.5 L380.9 209.3 L380.8 208.1 L380.8 206.8 L380.8 205.6 L380.8 204.3 L380.9 203.0 L379.8 202.1 L378.8 201.3 L377.9 200.5 L376.9 199.6 L376.1 198.7 L375.2 197.8 L374.5 196.9 L373.8 196.0 L373.2 195.0 L372.7 194.0 L372.2 192.9 L371.8 191.8 L371.5 190.6 L371.3 189.5 L371.0 188.2 L370.8 187.0 L370.7 185.7 L370.5 184.5 L369.4 183.8 L368.2 183.1 L367.1 182.4 L366.1 181.7 L365.1 181.0 L364.1 180.3 L363.3 179.5 L362.4 178.7 L361.7 177.8 L361.0 176.9 L360.4 175.9 L359.9 174.9 L359.4 173.8 L358.9 172.7 L358.5 171.5 L358.1 170.3 L357.8 169.1 L357.4 167.9 L356.2 167.4 L355.0 166.9 L353.8 166.4 L352.7 165.9 L351.6 165.3 L350.5 164.7 L349.5 164.1 L348.6 163.4 L347.7 162.7 L346.9 161.9 L346.1 161.0 L345.5 160.1 L344.8 159.1 L344.2 158.0 L343.6 157.0 L343.1 155.9 L342.5 154.7 L342.0 153.6 L340.0 154.1 L339.1 153.4 L338.2 152.7 L337.3 152.0 L336.3 151.3 L335.4 150.7 L334.4 150.0 L333.5 149.3 L332.5 148.7 L331.6 148.1 L330.6 147.4 L329.6 146.8 L328.7 146.2 L327.7 145.6 L326.7 145.0 L325.7 144.4 L324.7 143.9 L323.7 143.3 L322.7 142.7 L321.7 142.2 L320.7 141.6 L319.7 141.1 L318.7 140.6 L317.6 140.1 L316.6 139.6 L315.6 139.1 L314.5 138.6 L313.5 138.1 L312.4 137.7 L311.4 137.2 L310.3 136.8 L309.3 136.3ZM313.5 138.1 L276.0 129.0 L248.0 133.0 L220.0 141.0 L194.0 150.0 L170.0 155.0 L163.0 148.0 L170.0 141.0 L178.0 131.0 L180.0 120.0 L186.0 124.0 L197.0 113.0 L201.0 103.0 L206.0 108.0 L222.0 92.0 L206.0 90.0 L202.0 98.0 L198.0 89.0 L184.0 88.0 L179.0 99.0 L174.0 87.0 L160.0 86.0 L155.0 97.0 L150.0 85.0 L136.0 85.0 L127.0 82.0 L128.0 74.0 L140.0 66.0 L160.0 60.0 L184.0 56.0 L206.0 50.0 L222.0 40.0 L238.0 34.0 L256.0 37.0 L282.0 38.0 L312.0 46.0 L338.0 62.0 L362.2 86.0ZM288.0 42.0 L295.0 39.0 L302.2 36.6 L309.4 34.8 L316.7 33.6 L324.0 33.0 L331.5 33.0 L339.0 33.6 L346.7 34.9 L354.4 36.8 L362.2 39.2 L370.0 42.3 L378.0 46.0 L371.4 44.8 L365.0 43.9 L358.8 43.2 L352.7 42.9 L346.8 42.8 L341.0 43.0 L335.4 43.5 L330.0 44.2 L324.8 45.2 L319.7 46.6 L314.8 48.1 L310.0 50.0ZM262.0 40.0 L268.4 35.6 L274.9 31.8 L281.6 28.5 L288.4 25.8 L295.4 23.6 L302.5 22.0 L309.7 20.9 L317.1 20.4 L324.6 20.5 L332.3 21.1 L340.1 22.3 L348.0 24.0 L341.1 24.4 L334.5 25.1 L328.1 26.0 L322.0 27.1 L316.1 28.4 L310.5 30.0 L305.1 31.8 L300.0 33.8 L295.1 36.0 L290.5 38.4 L286.1 41.1 L282.0 44.0ZM394.0 225.2 L377.6 229.9 L360.7 229.6 L345.9 224.6 L335.7 217.9 L333.6 212.2 L318.7 203.4 L329.2 207.3 L317.7 193.4 L331.8 203.8 L324.0 185.9 L338.3 200.1 L346.1 203.8 L357.6 203.5 L370.5 196.2 L381.6 190.9ZM107.6 299.8 L121.0 295.5 L134.9 295.2 L147.2 298.9 L155.7 304.1 L157.6 308.7 L170.1 315.5 L161.3 312.6 L171.2 323.7 L159.3 315.6 L166.2 330.0 L154.1 318.7 L147.6 316.0 L138.1 316.6 L127.8 322.9 L118.9 327.6ZM248.1 48.5 L246.8 47.8 L244.9 47.4 L242.5 47.4 L239.9 47.7 L236.7 47.0 L234.0 47.8 L231.6 49.0 L229.6 50.3 L228.1 51.8 L227.4 53.3 L227.3 54.7 L228.0 55.9 L229.4 56.8 L231.3 57.4 L233.8 57.7 L236.5 57.6 L238.9 55.8 L241.7 55.0 L244.2 53.9 L246.2 52.8 L247.7 51.6 L248.6 50.4 L248.7 49.3ZM144.0 74.0 L152.0 72.0 L150.0 68.0 L142.0 70.0Z";
window.customIcons = window.customIcons || {};
if (!window.customIcons.taskdragon) {
  window.customIcons.taskdragon = {
    getIcon: async (name) => (name === "dragon" ? { path: TD_DRAGON_PATH, viewBox: "0 0 512 512" } : undefined),
    getIconList: async () => [{ name: "dragon", keywords: ["taskdragon", "ouroboros"] }],
  };
}

const AISLES = ["Produce", "Meat", "Dairy", "Spices/Pantry", "Hardware", "Other"];
const BUCKETS = [
  ["morning", "Morning", "mdi:weather-sunset-up"],
  ["afternoon", "Afternoon", "mdi:white-balance-sunny"],
  ["evening", "Evening", "mdi:weather-night"],
  ["anytime", "Anytime", "mdi:clock-outline"],
];
const KANBAN = [
  ["backlog", "Backlog"],
  ["ready", "Ready"],
  ["in_progress", "In Progress"],
  ["done", "Done"],
];
const PRIORITIES = ["none", "low", "medium", "high", "urgent"];
const PRIORITY_RANK = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 };
const ARCHETYPES = {
  quick_list: { label: "Quick list with sections", icon: "mdi:lightning-bolt-outline", hint: "Fast capture, collapsible sections, promote items later." },
  daily_chores: { label: "Time-blocked chores", icon: "mdi:broom", hint: "Morning / afternoon / evening agenda, streaks, rollover." },
  shopping_errands: { label: "Compact shopping grid", icon: "mdi:cart-outline", hint: "Aisle tiles, quantity merging, frequently bought." },
  projects_diy: { label: "Kanban / DIY", icon: "mdi:hammer-screwdriver", hint: "Kanban and dependency views, bill of materials." },
  packing_trips: { label: "Trip packing", icon: "mdi:bag-suitcase-outline", hint: "Dated trips, always-pack items added automatically." },
  home_maintenance: { label: "Home maintenance & assets", icon: "mdi:tools", hint: "Objects, intervals, sensor triggers, parts, documents, NFC & QR." },
  pantry_spices: { label: "Pantry & spices", icon: "mdi:shaker-outline", hint: "In stock / low / out with restock actions." },
  wishlist_hoard: { label: "Wishlist, gifts & price tracker", icon: "mdi:treasure-chest-outline", hint: "Concept tags, multi-store price tracking, gift lists with stealth mode, in-store scan." },
};
const ACTIONABLE = new Set(["quick_list", "daily_chores", "projects_diy", "home_maintenance"]);
const PACKING_GROUPS = ["Clothes", "Toiletries", "Tech", "Kids Gear", "Documents", "Food & Snacks", "Gear"];
const ICON_CHOICES = [
  "mdi:format-list-checks", "mdi:lightning-bolt-outline", "mdi:phone-outline", "mdi:home-outline", "mdi:broom",
  "mdi:washing-machine", "mdi:silverware-fork-knife", "mdi:cart-outline", "mdi:store-outline", "mdi:hammer-screwdriver",
  "mdi:hammer-wrench", "mdi:tools", "mdi:flower-outline", "mdi:tree-outline", "mdi:car-outline",
  "mdi:bag-suitcase-outline", "mdi:airplane", "mdi:tent", "mdi:beach", "mdi:gift-outline",
  "mdi:party-popper", "mdi:baby-carriage", "mdi:dog-side", "mdi:cat", "mdi:school-outline",
  "mdi:briefcase-outline", "mdi:laptop", "mdi:cash", "mdi:heart-pulse", "mdi:dumbbell",
  "mdi:book-open-variant", "mdi:music", "mdi:lightbulb-outline", "mdi:star-outline", "mdi:calendar-check",
  "mdi:shaker-outline", "mdi:treasure-chest-outline",
];
const WEEKDAYS = [
  ["MO", "Mon"],
  ["TU", "Tue"],
  ["WE", "Wed"],
  ["TH", "Thu"],
  ["FR", "Fri"],
  ["SA", "Sat"],
  ["SU", "Sun"],
];
const UNDO_MS = 5000;
const VIEW_MODES = ["quick", "auto", "personal", "kiosk_split"];

/* ------------------------------------------------------------------ */
/* Safe templating                                                     */
/* ------------------------------------------------------------------ */

class SafeHTML {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
const escapeText = (value) => String(value ?? "").replace(/[&<>"'`]/g, (c) => ESCAPES[c]);

/** Escaped text, safe to interpolate anywhere in an `html` template. */
const esc = (value) => new SafeHTML(escapeText(value));

function renderValue(value) {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return escapeText(value);
}

/** Tagged template: every interpolation is escaped unless it is itself an `html` result. */
function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHTML(out);
}

/** Only plain web links (or same-origin paths) may become an href. */
function safeUrl(url) {
  const value = String(url ?? "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/(?!\/)/.test(value)) return value;
  return null;
}

/** An image URL that is safe inside url('...') in a style attribute. */
function safeImageUrl(url) {
  const value = safeUrl(url);
  return value && /^[^\s"'()\\<>]+$/.test(value) ? value : null;
}

const ALLOWED_TAGS = new Set([
  "A", "B", "BUTTON", "CODE", "DATALIST", "DETAILS", "DIV", "EM", "FORM", "H2", "H3", "HA-CARD", "HA-ICON", "I", "INPUT",
  "LABEL", "LI", "NAV", "OPTGROUP", "OPTION", "P", "SECTION", "SELECT", "SMALL", "SPAN", "STRONG", "TABLE",
  "SUMMARY", "TBODY", "TD", "TEXTAREA", "TH", "THEAD", "TR", "UL",
]);
const ALLOWED_ATTRS = new Set([
  "accept", "capture", "label", "multiple", "autocomplete", "autofocus", "checked", "class", "colspan", "disabled", "enterkeyhint", "for", "hidden", "href",
  "icon", "id", "inputmode", "list", "max", "maxlength", "min", "name", "placeholder", "rel", "required", "role",
  "selected", "step", "style", "tabindex", "target", "title", "type", "value",
]);

/** A style attribute that loads something other than an http(s) or same-origin ("/x", never "//host") URL. */
const UNSAFE_STYLE = /expression\(|javascript:|url\(\s*(?!['"]?(?:https?:|\/(?!\/)))/i;

/** Remove anything outside the allow-lists from an inert (template) fragment. */
function sanitizeTree(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const doomed = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!ALLOWED_TAGS.has(node.tagName)) {
      doomed.push(node);
      continue;
    }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      const allowed = ALLOWED_ATTRS.has(name) || name.startsWith("data-") || name.startsWith("aria-");
      if (!allowed) node.removeAttribute(attr.name);
      else if (name === "href" && !safeUrl(attr.value) && attr.value !== "#") node.removeAttribute(attr.name);
      else if (name === "style" && UNSAFE_STYLE.test(attr.value)) node.removeAttribute(attr.name);
    }
    if (node.tagName === "A") {
      node.setAttribute("rel", "noopener noreferrer");
      node.setAttribute("target", "_blank");
    }
  }
  for (const node of doomed) node.remove();
  return root;
}

/** The only way TaskDragon puts markup into the page. */
function setHTML(element, content) {
  if (!(content instanceof SafeHTML)) throw new TypeError("TaskDragon refuses to render unescaped HTML");
  const template = document.createElement("template");
  template.innerHTML = content.value; // parsed inert: scripts don't run, images don't load
  element.replaceChildren(sanitizeTree(template.content));
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const parseDay = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const dayDiff = (from, to) => Math.round((parseDay(to) - parseDay(from)) / 86400000);
const localISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (iso, days) => {
  const d = new Date(parseDay(iso) + days * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
const fmtTime = (date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const weekdayShort = (iso) => new Date(parseDay(iso)).toLocaleDateString([], { weekday: "short", timeZone: "UTC" });
const monthDay = (iso) => new Date(parseDay(iso)).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = (iso) => new Date(parseDay(iso)).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Nov 14–16, 2026", "Nov 30 – Dec 2, 2026", "Jul 2027". */
function dateRange(start, end) {
  if (!start) return "No dates yet";
  const s = new Date(parseDay(start));
  if (!end || end === start) return fullDate(start);
  const e = new Date(parseDay(end));
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
  const month = (d) => d.toLocaleDateString([], { month: "short", timeZone: "UTC" });
  if (sameMonth) return `${month(s)} ${s.getUTCDate()}–${e.getUTCDate()}, ${s.getUTCFullYear()}`;
  if (sameYear) return `${month(s)} ${s.getUTCDate()} – ${month(e)} ${e.getUTCDate()}, ${s.getUTCFullYear()}`;
  return `${fullDate(start)} – ${fullDate(end)}`;
}

const hashColor = (text) => {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 55%, 46%)`;
};
const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const storage = {
  get(key, fallback) {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch (_err) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_err) {
      /* private mode: per-device conveniences only */
    }
  },
};

/** Fallback when <ha-markdown> isn't loaded. Input is escaped first; only a few tags are re-added. */
function simpleMarkdown(text) {
  const lines = escapeText(text).split(/\r?\n/);
  let out = "";
  let inList = false;
  for (const raw of lines) {
    const line = raw
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      if (!inList) out += "<ul>";
      inList = true;
      out += `<li>${item[1]}</li>`;
      continue;
    }
    if (inList) {
      out += "</ul>";
      inList = false;
    }
    out += line ? `<p>${line}</p>` : "";
  }
  // Built only from escaped text plus the fixed tags above; setHTML sanitizes it again.
  return new SafeHTML(out + (inList ? "</ul>" : ""));
}

/* ------------------------------------------------------------------ */
/* Shared data store (one per HA connection)                           */
/* ------------------------------------------------------------------ */

class TaskDragonStore {
  static for(hass) {
    const conn = hass.connection;
    if (!conn.__taskdragonStore) conn.__taskdragonStore = new TaskDragonStore(conn);
    conn.__taskdragonStore.hass = hass;
    return conn.__taskdragonStore;
  }

  constructor(conn) {
    this.conn = conn;
    this.hass = null;
    this.board = null;
    this.error = null;
    this.listeners = new Set();
    this._unsub = null;
    this._timer = null;
    this._onReady = () => this.refresh();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this._start();
    else if (this.board || this.error) listener(this.board, this.error);
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this._stop();
    };
  }

  async _start() {
    this.conn.addEventListener("ready", this._onReady);
    try {
      this._unsub = await this.conn.subscribeMessage(() => this.refreshSoon(), { type: "taskdragon/subscribe" });
    } catch (err) {
      this.error = err.message || String(err);
    }
    await this.refresh();
  }

  _stop() {
    this.conn.removeEventListener("ready", this._onReady);
    if (this._unsub) this._unsub();
    this._unsub = null;
  }

  refreshSoon() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.refresh(), 120);
  }

  async refresh() {
    try {
      this.board = await this.conn.sendMessagePromise({ type: "taskdragon/get_board" });
      this.error = null;
    } catch (err) {
      this.error = err.message || String(err);
    }
    this._emit();
  }

  _emit() {
    for (const listener of this.listeners) listener(this.board, this.error);
  }

  patchTask(uid, changes) {
    if (!this.board) return;
    const task = this.board.tasks.find((t) => t.uid === uid);
    if (task) Object.assign(task, changes);
    this._emit();
  }

  patchPrefs(changes) {
    if (!this.board) return;
    this.board.prefs = { ...(this.board.prefs || {}), ...changes };
    this._emit();
  }

  call(message) {
    return this.conn.sendMessagePromise(message);
  }
}

/* ------------------------------------------------------------------ */
/* Maintenance constants & styles                                      */
/* ------------------------------------------------------------------ */

const MAINT_STATUS = {
  ok: { label: "OK", icon: "mdi:check-bold", cls: "ok", rank: 0 },
  due_soon: { label: "Due Soon", icon: "mdi:clock-alert-outline", cls: "soon", rank: 1 },
  overdue: { label: "Overdue", icon: "mdi:alert-circle-outline", cls: "over", rank: 2 },
  triggered: { label: "Triggered", icon: "mdi:flash-alert-outline", cls: "trig", rank: 3 },
};
const MAINT_CATEGORIES = ["Replacement", "Service", "Cleaning", "Inspection", "Calibration", "Refill"];
const MAINT_UNITS = [["days", "Days"], ["weeks", "Weeks"], ["months", "Months"], ["years", "Years"]];
const MAINT_SCHEDULES = [
  ["rolling", "Rolling — from the day it was actually done"],
  ["planned", "Planned — anchored, late completions don't drift"],
  ["once", "Once — a single due date"],
  ["none", "No schedule — sensor triggers only"],
];
const MAINT_TRIGGERS = [
  ["threshold", "Threshold (above / below for N minutes)"],
  ["counter", "Counter increase (gallons, kWh, miles, print hours…)"],
  ["runtime", "Runtime in a state (hours heating, running…)"],
  ["state_count", "Number of state changes"],
  ["problem", "Problem / moisture sensor"],
  ["salt_level", "Water softener salt level"],
];
const MAINT_OBJECT_TYPES = [["generic", "Appliance / system"], ["water_softener", "Water softener"], ["vehicle", "Vehicle"], ["battery_fleet", "Battery fleet"]];
const DOC_CATEGORIES_UI = ["manual", "invoice", "warranty", "photo", "other"];
const DOC_ICONS = { manual: "mdi:book-open-variant", invoice: "mdi:receipt-text-outline", warranty: "mdi:shield-check-outline", photo: "mdi:image-outline", other: "mdi:file-outline" };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EVENT_LABELS = {
  completed: "Completed",
  skipped: "Skipped",
  missed: "Missed",
  purchase: "Restocked",
  salt: "Salt",
  regeneration: "Regeneration detected",
  part_used: "Used part",
};
const METHOD_LABELS = {
  nfc: "Completed via NFC tag",
  auto_recovery: "Auto-completed — sensor recovered",
  todo: "Checked off in the to-do list",
  qr: "Completed from a QR code",
  service: "Completed by an automation",
  migrated: "Imported from the old list",
  restock: "Bought from the shopping list",
  flow: "Detected from the flow meter",
  sensor: "Reported by the level sensor",
};

/** MM/DD/YYYY for an ISO date or datetime (local time for datetimes). */
function usDate(value) {
  if (!value) return "—";
  const text = String(value);
  if (text.length <= 10) {
    const [y, m, d] = text.split("-");
    return `${m}/${d}/${y}`;
  }
  const date = new Date(text);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function money(amount, currency) {
  const value = Number(amount || 0);
  const text = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${text} ${currency || "$"}`;
}

const MAINT_STYLES = `
.maint { display: flex; flex-direction: column; gap: 10px; }
.msummary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.mtile { background: var(--td-surface); border: 1px solid var(--td-divider); border-radius: var(--td-radius); padding: 10px 12px; text-align: left; display: flex; flex-direction: column; gap: 2px; min-height: 64px; }
.mtile .n { font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.mtile .l { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--td-muted); font-weight: 600; }
.mtile.over .n { color: var(--td-danger); }
.mtile.soon .n { color: var(--td-warn); }
.mtile.trig .n { color: #f4511e; }
.mtile.on { border-color: var(--td-accent); box-shadow: inset 0 0 0 1px var(--td-accent); }
@media (max-width: 560px) { .msummary { grid-template-columns: repeat(3, minmax(0, 1fr)); } .mtile .n { font-size: 1.25rem; } }
.msubnav { display: flex; align-items: center; gap: 2px; border-bottom: 1px solid var(--td-divider); flex-wrap: wrap; }
.msubnav .tab { padding: 8px 12px; }
.msubnav .grow { flex: 1; }
.msearch { flex: 1 1 200px; border-radius: 18px; min-height: 36px; }
.mfilters { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
.mfilters label { display: flex; flex-direction: column; gap: 2px; font-size: .68rem; color: var(--td-muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.mfilters select { min-height: 34px; padding: 4px 8px; font-size: .85rem; }
.mfilters .grow { flex: 1; }
.maddmenu { position: relative; }
.mgroup { margin: 4px 0 8px; }
.mgroup-head { font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--td-muted); font-weight: 600; padding: 6px 2px; display: flex; gap: 8px; align-items: center; }
.mrow { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(120px, 220px) auto; gap: 10px; align-items: center; padding: 10px 8px; border-top: 1px solid var(--td-divider); }
.mrow:first-child { border-top: none; }
.mrow:hover { background: var(--td-surface); }
.mrow.sel { grid-template-columns: auto auto minmax(0, 1fr) minmax(120px, 220px) auto; }
@media (max-width: 720px) {
  .mrow, .mrow.sel { grid-template-columns: auto minmax(0, 1fr); }
  .mrow .mrow-progress, .mrow .mrow-actions { grid-column: 1 / -1; }
  .mrow .mrow-actions { justify-content: flex-start; }
}
.mrow-status { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-width: 92px; }
.mpill { display: inline-flex; align-items: center; gap: 4px; border-radius: 12px; padding: 2px 9px; font-size: .74rem; font-weight: 700; white-space: nowrap; }
.mpill ha-icon { --mdc-icon-size: 14px; }
.mpill.ok { background: color-mix(in srgb, var(--td-ok) 18%, transparent); color: var(--td-ok); }
.mpill.soon { background: color-mix(in srgb, var(--td-warn) 22%, transparent); color: color-mix(in srgb, var(--td-warn) 75%, var(--td-text)); }
.mpill.over { background: color-mix(in srgb, var(--td-danger) 18%, transparent); color: var(--td-danger); }
.mpill.trig { background: color-mix(in srgb, #f4511e 20%, transparent); color: #f4511e; }
.mpill.nfc { background: color-mix(in srgb, var(--td-accent) 15%, transparent); color: var(--td-accent); font-size: .66rem; letter-spacing: .05em; }
.mrow-main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.mrow-titles { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
.mlink { background: none; border: none; padding: 0; color: var(--td-accent); font-size: .9rem; cursor: pointer; text-align: left; }
.mlink:hover { text-decoration: underline; }
.mtitle { background: none; border: none; padding: 0; font-weight: 700; font-size: 1rem; color: var(--td-text); cursor: pointer; text-align: left; }
.mtitle:hover { text-decoration: underline; }
.mcode { font-size: .72rem; color: var(--td-muted); font-family: var(--code-font-family, monospace); }
.mrow-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.mchip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--td-divider); border-radius: 12px; padding: 1px 8px 1px 4px; font-size: .75rem; color: var(--td-text); background: var(--td-bg); }
.mchip ha-icon { --mdc-icon-size: 14px; color: var(--td-muted); }
.mchip .avatar.sm { width: 18px; height: 18px; font-size: .55rem; }
.mcat { font-size: .75rem; color: var(--td-muted); }
.mrow-progress { display: flex; flex-direction: column; gap: 3px; }
.mbar { height: 7px; background: var(--td-surface); border-radius: 4px; overflow: hidden; border: 1px solid var(--td-divider); }
.mbar > span { display: block; height: 100%; border-radius: 4px; background: var(--td-ok); transition: width .25s; }
.mbar.soon > span { background: var(--td-warn); }
.mbar.over > span { background: var(--td-danger); }
.mbar.trig > span { background: #f4511e; }
.mcount { font-size: .8rem; color: var(--td-muted); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mrow-actions { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
.mbtn { border-radius: 16px; padding: 4px 12px; font-size: .82rem; font-weight: 600; min-height: 32px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.mbtn ha-icon { --mdc-icon-size: 16px; }
.mbtn.ok { background: var(--td-ok); color: #fff; border: 1px solid var(--td-ok); }
.mbtn.skip { background: none; color: #ef6c00; border: 1px solid #ef6c00; }
.mbtn.plain { background: var(--td-surface); color: var(--td-text); border: 1px solid var(--td-divider); }
.mbtn:disabled { opacity: .45; cursor: not-allowed; }
.mcrumb { display: flex; align-items: center; gap: 6px; font-size: .85rem; color: var(--td-muted); flex-wrap: wrap; }
.mcrumb button { background: none; border: none; padding: 2px 0; color: var(--td-accent); font: inherit; cursor: pointer; }
.mhead { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
.mhead .grow { flex: 1 1 240px; min-width: 0; }
.mhead h2 { margin: 0; font-size: 1.35rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mid { font-size: .78rem; font-weight: 600; border: 1px solid var(--td-divider); border-radius: 8px; padding: 1px 7px; color: var(--td-muted); }
.msub { font-size: .88rem; color: var(--td-muted); display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; align-items: center; }
.mhead-actions { display: flex; gap: 6px; align-items: center; position: relative; }
.mtabs { display: flex; gap: 2px; border-bottom: 1px solid var(--td-divider); }
.mkpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.mkpi { background: var(--td-surface); border-radius: 10px; padding: 10px 12px; border: 1px solid var(--td-divider); }
.mkpi .k { font-size: .66rem; text-transform: uppercase; letter-spacing: .07em; color: var(--td-muted); font-weight: 700; }
.mkpi .v { font-size: 1.05rem; font-weight: 600; margin-top: 4px; }
.mkpi .v.big { font-size: 1.7rem; font-weight: 700; }
.mcallout { border-left: 4px solid var(--td-accent); background: color-mix(in srgb, var(--td-accent) 7%, var(--td-bg)); border-radius: 8px; padding: 10px 12px; font-size: .92rem; display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
.mcallout ha-icon { color: var(--td-accent); }
.mcallout .grow { flex: 1 1 200px; }
.mtimeline { background: var(--td-surface); border-radius: 10px; padding: 12px; border: 1px solid var(--td-divider); }
.mtimeline .ends { display: flex; justify-content: space-between; font-size: .8rem; color: var(--td-muted); margin-bottom: 6px; gap: 10px; }
.mtimeline .mid-label { text-align: center; font-size: .85rem; margin-top: 6px; font-weight: 600; }
.mcard { border: 1px solid var(--td-divider); border-radius: var(--td-radius); padding: 10px 12px; background: var(--td-bg); }
.mcard h3 { margin: 0 0 8px; font-size: .9rem; display: flex; align-items: center; gap: 8px; }
.mcard h3 .grow { flex: 1; }
.mevent { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid var(--td-divider); align-items: flex-start; }
.mevent:first-of-type { border-top: none; }
.mevent .dot { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; background: color-mix(in srgb, var(--td-ok) 18%, transparent); color: var(--td-ok); }
.mevent .dot.skipped, .mevent .dot.missed { background: color-mix(in srgb, #ef6c00 18%, transparent); color: #ef6c00; }
.mevent .dot.purchase, .mevent .dot.salt, .mevent .dot.regeneration { background: color-mix(in srgb, var(--td-accent) 15%, transparent); color: var(--td-accent); }
.mevent .dot ha-icon { --mdc-icon-size: 16px; }
.mevent .body { flex: 1; min-width: 0; font-size: .88rem; }
.mevent .when { color: var(--td-muted); font-size: .8rem; }
.mevent .note { margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
.macc { border: 1px solid var(--td-divider); border-radius: var(--td-radius); overflow: hidden; background: var(--td-bg); }
.macc-head { display: flex; align-items: center; gap: 8px; padding: 2px 8px 2px 2px; background: var(--td-surface); flex-wrap: wrap; }
.macc-body { padding: 8px 12px 12px; }
.mtank-wrap { display: flex; gap: 16px; align-items: stretch; flex-wrap: wrap; }
.mtank { position: relative; width: 74px; height: 170px; border: 2px solid var(--td-divider); border-radius: 10px 10px 16px 16px; overflow: hidden; background: var(--td-surface); flex: 0 0 auto; }
.mtank .salt { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #eceff1, #b0bec5); transition: height .3s; }
.mtank .salt.low { background: linear-gradient(180deg, #ffccbc, #ff8a65); }
.mtank .mark { position: absolute; left: 0; right: 0; border-top: 1px dashed color-mix(in srgb, var(--td-text) 25%, transparent); font-size: .6rem; color: var(--td-muted); padding-left: 3px; line-height: 1; }
.mtank .warn { border-top: 2px solid var(--td-danger); }
.mtank-stats { flex: 1 1 220px; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; align-content: start; }
.mtank-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
.mlevel { min-width: 40px; }
.mpart { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--td-divider); }
.mpart:first-child { border-top: none; }
.mstock { font-weight: 700; padding: 2px 9px; border-radius: 12px; background: color-mix(in srgb, var(--td-ok) 16%, transparent); color: var(--td-ok); font-size: .8rem; white-space: nowrap; }
.mstock.low { background: color-mix(in srgb, var(--td-danger) 16%, transparent); color: var(--td-danger); }
.mdoc { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--td-divider); }
.mdoc:first-child { border-top: none; }
.mdoc .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mupload { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.mcal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.mcal .dow { font-size: .7rem; text-align: center; color: var(--td-muted); font-weight: 700; text-transform: uppercase; }
.mcal .day { min-height: 84px; border: 1px solid var(--td-divider); border-radius: 8px; padding: 4px; font-size: .75rem; display: flex; flex-direction: column; gap: 2px; background: var(--td-bg); overflow: hidden; }
.mcal .day.out { opacity: .45; }
.mcal .day.today { border-color: var(--td-accent); box-shadow: inset 0 0 0 1px var(--td-accent); }
.mcal .num { font-weight: 700; font-size: .78rem; }
.mcal .item { border-radius: 6px; padding: 1px 4px; background: var(--td-surface); border: none; text-align: left; font-size: .7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; color: var(--td-text); }
.mcal .item.over, .mcal .item.trig { background: color-mix(in srgb, var(--td-danger) 16%, transparent); }
.mcal .item.soon { background: color-mix(in srgb, var(--td-warn) 20%, transparent); }
.mcal .item.done { opacity: .6; text-decoration: line-through; }
.mcal .item.proj { border: 1px dashed var(--td-divider); background: none; }
.mspend { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; align-items: end; height: 120px; margin: 8px 0; }
.mspend .bar { background: color-mix(in srgb, var(--td-accent) 70%, transparent); border-radius: 4px 4px 0 0; min-height: 2px; position: relative; }
.mspend-labels { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; font-size: .65rem; color: var(--td-muted); text-align: center; }
.mtable { width: 100%; border-collapse: collapse; font-size: .88rem; }
.mtable td { padding: 6px 4px; border-top: 1px solid var(--td-divider); }
.mtable td.r { text-align: right; white-space: nowrap; }
.mtree { display: flex; flex-direction: column; }
.mtree .node { display: flex; align-items: center; gap: 10px; padding: 9px 8px; border-top: 1px solid var(--td-divider); cursor: pointer; background: none; border-left: none; border-right: none; border-bottom: none; text-align: left; color: var(--td-text); width: 100%; }
.mtree .node:hover { background: var(--td-surface); }
.mtree .node .grow { flex: 1; min-width: 0; }
.mtrig { padding: 6px 0; border-top: 1px solid var(--td-divider); font-size: .88rem; }
.mtrig:first-of-type { border-top: none; }
.mtrig .row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.mrec { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mrec .grow { flex: 1 1 220px; font-size: .9rem; }
.mtrigger-edit { border: 1px solid var(--td-divider); border-radius: 10px; padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mtrigger-edit .full { grid-column: 1 / -1; }
.mmonths { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.mqr { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.mqr .qr-slot canvas { width: 240px; height: 240px; image-rendering: pixelated; background: #fff; border-radius: 8px; }
.mqr .url { font-size: .72rem; color: var(--td-muted); word-break: break-all; text-align: center; }
.mresult { display: flex; gap: 10px; align-items: center; padding: 8px 4px; border-top: 1px solid var(--td-divider); width: 100%; background: none; border-left: none; border-right: none; border-bottom: none; text-align: left; color: var(--td-text); cursor: pointer; }
.mresult:hover { background: var(--td-surface); }
.mresult .grow { flex: 1; min-width: 0; }
.maint .banner { font-size: .9rem; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--td-accent) 10%, transparent); display: flex; gap: 8px; align-items: center; }
.mtabs .tab { padding: 8px 12px; }
.mrow input.sel { width: 18px; height: 18px; min-height: auto; }
.mattn { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-top: 1px solid var(--td-divider); }
.mattn .grow { flex: 1; min-width: 0; }
.mtriggers { display: flex; flex-direction: column; gap: 8px; }
.mtemplates small { display: block; }
.mcomplete-form .mupload input[type=file] { min-height: auto; border: none; padding: 0; }
.dialog .mgroup-head { margin: 6px 0 0; border-top: 1px solid var(--td-divider); padding-top: 10px; }
.dialog .mgroup-head .grow { flex: 1; }
.mfilters .toggle-group, .mtrigger-edit .toggle-group { display: inline-flex; gap: 4px; align-items: center; }
.mtrigger-edit .toggle-group select { flex: 1; }
.chip input[type=radio] { width: 14px; height: 14px; min-height: auto; margin: 0; }
`;

/* ------------------------------------------------------------------ */
/* Mealie recipe browser styles                                        */
/* ------------------------------------------------------------------ */

const RECIPE_SORTS = [
  ["az", "A–Z"],
  ["recent", "Recently added"],
  ["cooked", "Most cooked"],
  ["category", "By category"],
];
const MEAL_TYPES = [
  ["dinner", "Dinner"],
  ["lunch", "Lunch"],
  ["breakfast", "Breakfast"],
  ["side", "Side"],
  ["snack", "Snack"],
  ["dessert", "Dessert"],
];
const RECIPE_PAGE = 60;

const RECIPE_STYLES = `
.rshoptabs { margin-bottom: 8px; }
@media (max-width: 520px) { .rshoptabs .long { display: none; } }
.rfilters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 4px 0 8px; }
.rfilters input[type=search] { flex: 1 1 200px; border-radius: 18px; min-height: 36px; padding: 6px 14px; min-width: 0; }
.rfilters select { min-height: 36px; padding: 4px 8px; max-width: 100%; flex: 1 1 140px; }
.rnote { font-size: .8rem; color: var(--td-muted); margin-bottom: 8px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.rgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.rcard { border: 1px solid var(--td-divider); border-radius: var(--td-radius); overflow: hidden; display: flex; flex-direction: column; background: var(--td-bg); min-width: 0; }
.rimg { aspect-ratio: 16 / 10; background: var(--td-surface); display: flex; align-items: center; justify-content: center; color: var(--td-muted); overflow: hidden; }
.rimg ha-icon { --mdc-icon-size: 36px; opacity: .45; }
.rimg img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rbody { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
.rtitle { font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; background: none; border: none; padding: 0; text-align: left; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.rtitle:hover { color: var(--td-accent); text-decoration: underline; }
.rimg[data-action] { cursor: pointer; }
.rmeta { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: .78rem; color: var(--td-muted); }
.ractions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; align-items: center; }
.ractions .btn { flex: 1 1 auto; justify-content: center; }
@media (max-width: 520px) {
  .rgrid { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .rcard { flex-direction: row; }
  .rimg { flex: 0 0 92px; width: 92px; aspect-ratio: auto; min-height: 92px; }
  .ractions .btn { flex: 1 1 40%; padding: 4px 8px; }
}
.rgroup { grid-column: 1 / -1; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--td-muted); font-weight: 600; padding: 6px 2px 0; }
.rmore { display: flex; justify-content: center; margin: 12px 0; }
.rrow { display: flex; gap: 10px; align-items: center; padding: 8px 4px; border-top: 1px solid var(--td-divider); cursor: pointer; }
.rrow:first-child { border-top: none; }
.rrow input { width: 20px; height: 20px; min-height: auto; flex: 0 0 auto; }
.rrow .grow { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.rrow.skip .grow { color: var(--td-muted); }
.rchips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.rchips .chip { padding-right: 2px; }
.rchips .x { background: none; border: none; width: 26px; height: 26px; border-radius: 50%; color: var(--td-muted); display: inline-flex; align-items: center; justify-content: center; padding: 0; }
.rchips .x:hover { background: var(--td-surface); color: var(--td-danger); }
.rdays { display: flex; flex-wrap: wrap; gap: 6px; }
.rpantry { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0 12px; }
.rpantry label { display: flex; align-items: center; gap: 8px; padding: 6px 2px; font-size: .9rem; color: var(--td-text); cursor: pointer; }
.rpantry input { width: 18px; height: 18px; min-height: auto; }
.rsettings .shop-add { margin-top: 6px; }
`;

/* ------------------------------------------------------------------ */
/* Barcode scanner, cooking view and backups: constants & styles       */
/* ------------------------------------------------------------------ */

const SCAN_FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "code_39", "qr_code"];
// Bundled with the integration (Apache-2.0) and only loaded where the browser has no BarcodeDetector.
const ZXING_SRC = "/taskdragon_static/vendor/zxing-library-0.23.0.min.js";
const ZXING_FORMATS = { upc_a: "UPC_A", upc_e: "UPC_E", ean_13: "EAN_13", ean_8: "EAN_8", code_128: "CODE_128", code_39: "CODE_39", qr_code: "QR_CODE" };
const RESTOCK_PILLS = [1, 2, 4, 6];
const COOK_SCALES = [0.5, 1, 2, 3];
const KEEP_AWAKE_KEY = "taskdragon.keepAwake";
const AMOUNT_FRACTIONS = [[1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"]];

let zxingPromise = null;

/** Load the bundled ZXing build once; resolves to the ZXing namespace. */
function loadZXing() {
  if (window.ZXing?.MultiFormatReader) return Promise.resolve(window.ZXing);
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      // An AMD loader on the page would swallow the UMD bundle; hide it while the script runs.
      const amd = typeof window.define === "function" && window.define.amd ? window.define : null;
      if (amd) window.define = undefined;
      const script = document.createElement("script");
      script.src = ZXING_SRC;
      script.async = true;
      const done = (ok) => {
        if (amd) window.define = amd;
        if (ok && window.ZXing?.MultiFormatReader) resolve(window.ZXing);
        else {
          zxingPromise = null;
          reject(new Error("The barcode reader could not be loaded"));
        }
      };
      script.onload = () => done(true);
      script.onerror = () => done(false);
      document.head.appendChild(script);
    });
  }
  return zxingPromise;
}

/** 1.5 → "1½", 0.333 → "⅓", 2 → "2", 1.27 (no fraction) → "1.27". */
function fmtAmount(value, fraction = true) {
  if (!Number.isFinite(value) || value <= 0) return "";
  const whole = Math.floor(value + 0.02);
  const rest = value - whole;
  if (Math.abs(rest) < 0.02) return String(whole);
  if (fraction) {
    const [best, glyph] = AMOUNT_FRACTIONS.reduce((acc, f) => (Math.abs(f[0] - rest) < Math.abs(acc[0] - rest) ? f : acc));
    if (Math.abs(best - rest) < 0.03) return whole ? `${whole}${glyph}` : glyph;
  }
  return String(Math.round(value * 100) / 100);
}

/** An ingredient line at a batch multiplier: { amount: "1½ cups", rest: "orzo, rinsed" }. */
function scaledIngredient(row, scale) {
  if (row.quantity == null) return { amount: "", rest: row.display };
  const qty = row.quantity * scale;
  const unit = row.unit;
  let unitText = "";
  if (unit) unitText = unit.use_abbreviation && unit.abbreviation ? unit.abbreviation : qty > 1 && unit.plural ? unit.plural : unit.name;
  const food = qty > 1 && row.food_plural ? row.food_plural : row.food;
  return {
    amount: [fmtAmount(qty, unit ? unit.fraction : true), unitText].filter(Boolean).join(" "),
    rest: `${food || ""}${row.note ? `, ${row.note}` : ""}`,
  };
}

const fmtClock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const fmtBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};

/** The Mealie slug a task points at (recipe imports and meal-plan prep/cook tasks), if any. */
function taskRecipeSlug(task) {
  if (task.source === "mealie_recipe" && task.source_ref) return task.source_ref;
  if ((task.source === "mealie_prep" || task.source === "mealie_cook") && task.link_url) {
    const match = String(task.link_url).match(/\/r\/([^/?#]+)\/?(?:[?#].*)?$/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

const SCAN_STYLES = `
.td-scan { position: fixed; inset: 0; z-index: 10000; background: #000; color: #fff; overflow: hidden; touch-action: none; }
.td-scan video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.td-scan .reticle { position: absolute; left: 50%; top: 44%; width: min(80vw, 440px); height: min(44vw, 230px); transform: translate(-50%, -50%); border-radius: 16px; border: 2px solid rgba(255,255,255,.92); box-shadow: 0 0 0 200vmax rgba(0,0,0,.5); pointer-events: none; transition: border-color .15s; }
.td-scan .reticle::after { content: ""; position: absolute; left: 7%; right: 7%; top: 50%; height: 2px; background: #ff5252; box-shadow: 0 0 10px #ff5252; animation: td-laser 1.8s ease-in-out infinite; }
.td-scan.hit .reticle { border-color: #69f0ae; }
@keyframes td-laser { 0%, 100% { transform: translateY(-42px); } 50% { transform: translateY(42px); } }
.td-scan .sbar { position: absolute; left: 0; right: 0; top: 0; z-index: 2; display: flex; gap: 8px; align-items: center; padding: max(12px, env(safe-area-inset-top)) 12px 18px; background: linear-gradient(rgba(0,0,0,.75), transparent); }
.td-scan .sbar .grow { flex: 1; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-scan .sbtn { background: rgba(255,255,255,.18); color: #fff; border: none; border-radius: 50%; width: 46px; height: 46px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.td-scan .sbtn[hidden] { display: none; }
.td-scan .sbtn.on { background: #ffd54f; color: #222; }
.td-scan .sbottom { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 22px 14px max(16px, env(safe-area-inset-bottom)); background: linear-gradient(transparent, rgba(0,0,0,.85) 35%); display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.td-scan .sstatus { text-align: center; font-size: .95rem; line-height: 1.35; }
.td-scan .sstatus.warn { color: #ffd54f; }
.td-scan .smanual { display: flex; gap: 8px; max-width: 460px; width: 100%; margin: 0 auto; }
.td-scan .smanual input { flex: 1; min-width: 0; border-radius: 22px; border: none; padding: 10px 16px; font-size: 1rem; background: rgba(255,255,255,.95); color: #111; }
.td-scan .smanual button { border-radius: 22px; border: none; padding: 0 16px; background: var(--td-accent, #03a9f4); color: #fff; font-weight: 600; }
.td-scan .sengine { text-align: center; font-size: .75rem; opacity: .65; }
.backdrop.sheet-wrap { align-items: flex-end; }
.dialog.sheet { width: min(560px, 100%); border-radius: 18px 18px 0 0; padding-bottom: max(16px, env(safe-area-inset-bottom)); }
@media (min-width: 700px) { .backdrop.sheet-wrap { align-items: center; } .dialog.sheet { border-radius: var(--td-radius); } }
.ssheet-head { display: flex; gap: 12px; align-items: flex-start; }
.ssheet-head .sicon { width: 44px; height: 44px; border-radius: 12px; background: var(--td-surface); display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.ssheet-head h2 { margin: 0; font-size: 1.15rem; }
.sstock { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 10px 0 14px; font-size: .92rem; color: var(--td-muted); }
.sstock strong { color: var(--td-text); font-size: 1.05rem; }
.sstock .low { color: var(--td-danger); font-weight: 600; }
.sactions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sactions .btn { min-height: 56px; font-size: 1.02rem; justify-content: center; }
.sbig { background: var(--td-accent); color: #fff; }
.spills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
.spills .chip { min-width: 54px; min-height: 42px; justify-content: center; font-size: 1rem; font-weight: 600; }
.spills input { width: 90px; min-height: 42px; text-align: center; }
.scode { margin-top: 14px; display: flex; gap: 8px; align-items: center; font-size: .8rem; color: var(--td-muted); flex-wrap: wrap; }
.scode code { background: var(--td-surface); padding: 2px 6px; border-radius: 6px; }
.slink-suggest { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--td-radius); background: var(--td-surface); margin: 6px 0 12px; }
.slink-suggest .grow { min-width: 0; }
.slink-list { max-height: min(46vh, 360px); overflow: auto; border: 1px solid var(--td-divider); border-radius: var(--td-radius); }
.slink-row { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-top: 1px solid var(--td-divider); cursor: pointer; }
.slink-row:first-child { border-top: none; }
.slink-row input { width: 20px; height: 20px; min-height: auto; flex: 0 0 auto; }
.slink-row .grow { min-width: 0; overflow-wrap: anywhere; }
.slink-row.on { background: color-mix(in srgb, var(--td-accent) 10%, transparent); }
.slink-search { width: 100%; margin-bottom: 8px; }
.td-toast { flex-wrap: wrap; row-gap: 2px; z-index: 10002; width: max-content; box-sizing: border-box; }
`;

const COOK_STYLES = `
.backdrop.cook-wrap { padding: 0; }
.dialog.cook { width: min(1120px, 96vw); height: min(92vh, 1000px); max-height: none; padding: 0; display: flex; flex-direction: column; overflow: hidden; }
@media (max-width: 700px) { .dialog.cook { width: 100vw; height: 100vh; height: 100dvh; border-radius: 0; } }
.cook-head { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--td-divider); background: var(--td-bg); flex-wrap: wrap; }
.cook-head .ctitle { flex: 1 1 160px; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cawake { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 22px; border: 2px solid var(--td-divider); font-weight: 600; cursor: pointer; user-select: none; min-height: 40px; }
.cawake input { width: 20px; height: 20px; min-height: auto; margin: 0; }
.cawake.on { border-color: #f9a825; background: color-mix(in srgb, #ffd54f 28%, transparent); }
.cawake .sun { color: #f9a825; --mdc-icon-size: 22px; }
.cawake-status { font-size: .75rem; color: var(--td-muted); }
.cawake-status.on { color: #2e7d32; }
.cook-scroll { flex: 1; overflow: auto; padding: 0 0 16px; overscroll-behavior: contain; }
.cook-hero { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 18px; padding: 16px; }
@media (max-width: 700px) { .cook-hero { grid-template-columns: minmax(0, 1fr); padding: 0 0 8px; gap: 10px; } .cook-hero .cmeta { padding: 0 14px; } }
.cook-img { aspect-ratio: 4 / 3; background: var(--td-surface); border-radius: var(--td-radius); overflow: hidden; display: flex; align-items: center; justify-content: center; color: var(--td-muted); }
.cook-img ha-icon { --mdc-icon-size: 48px; opacity: .45; }
.cook-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
@media (max-width: 700px) { .cook-img { border-radius: 0; aspect-ratio: 16 / 9; } }
.cmeta h2 { margin: 0 0 6px; font-size: 1.5rem; line-height: 1.2; overflow-wrap: anywhere; }
.cmeta .cdesc { color: var(--td-muted); margin: 0 0 10px; line-height: 1.45; }
.ctimes { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 10px 0; }
.ctimes div { display: flex; flex-direction: column; font-size: .75rem; color: var(--td-muted); text-transform: uppercase; letter-spacing: .04em; }
.ctimes strong { font-size: 1rem; color: var(--td-text); text-transform: none; letter-spacing: 0; }
.cscale { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0; }
.cscale .chip { min-width: 52px; min-height: 40px; justify-content: center; font-weight: 700; }
.cook-cols { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 22px; padding: 0 16px; }
@media (max-width: 860px) { .cook-cols { grid-template-columns: minmax(0, 1fr); padding: 0 14px; } }
.cook-cols h3 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 14px 0 8px; font-size: 1.15rem; }
.caddmissing { width: 100%; justify-content: center; min-height: 46px; margin-bottom: 8px; }
.csection { font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--td-muted); font-weight: 700; margin: 14px 0 4px; }
.cing { display: flex; gap: 12px; align-items: flex-start; padding: 9px 2px; border-bottom: 1px solid var(--td-divider); cursor: pointer; font-size: 1.05rem; line-height: 1.4; }
.cing input { width: 26px; height: 26px; min-height: auto; flex: 0 0 auto; margin: 0; }
.cing .grow { min-width: 0; overflow-wrap: anywhere; }
.cing .amt { font-weight: 700; }
.cing.got .grow { text-decoration: line-through; opacity: .5; }
.cing .badge { margin-left: 4px; }
.cstep { display: flex; gap: 14px; padding: 14px 10px; border-radius: var(--td-radius); border: 2px solid transparent; cursor: pointer; margin-bottom: 6px; }
.cstep .cnum { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 50%; background: var(--td-surface); display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.05rem; }
.cstep .ctext { flex: 1; min-width: 0; font-size: 1.18rem; line-height: 1.6; color: var(--primary-text-color, var(--td-text)); white-space: pre-wrap; overflow-wrap: anywhere; }
.cstep .ctext strong { display: block; font-size: 1rem; margin-bottom: 2px; }
.cstep.current { border-color: var(--td-accent); background: color-mix(in srgb, var(--td-accent) 8%, transparent); }
.cstep.current .cnum { background: var(--td-accent); color: #fff; }
.cstep.done { opacity: .5; }
.cstep.done .cnum { background: #2e7d32; color: #fff; }
.ctimer-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; white-space: normal; }
.ctimer-pill { display: inline-flex; align-items: center; gap: 6px; border: 2px solid var(--td-accent); color: var(--td-accent); background: none; border-radius: 22px; padding: 6px 14px; font-weight: 700; font-size: .95rem; min-height: 40px; cursor: pointer; }
.cnotes { margin: 18px 16px 0; padding: 12px 14px; border-radius: var(--td-radius); background: color-mix(in srgb, #ffd54f 22%, transparent); border-left: 4px solid #f9a825; }
.cnotes h3 { margin: 0 0 6px; font-size: 1rem; display: flex; gap: 6px; align-items: center; }
.cnotes p { margin: 4px 0 10px; white-space: pre-wrap; line-height: 1.5; }
.cnutrition { margin: 14px 16px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px 14px; font-size: .9rem; }
.cnutrition div { display: flex; justify-content: space-between; border-bottom: 1px dotted var(--td-divider); padding: 3px 0; }
.cook-timers { border-top: 1px solid var(--td-divider); background: var(--td-bg); padding: 8px 12px max(8px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 6px; }
.cook-timers:empty { display: none; }
.ctbar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 12px; background: var(--td-surface); }
.ctbar .grow { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.ctbar .ctime { font-variant-numeric: tabular-nums; font-size: 1.4rem; font-weight: 800; min-width: 74px; text-align: right; }
.ctbar.paused .ctime { opacity: .55; }
.ctbar.done { background: var(--td-danger); color: #fff; animation: td-pulse 1s ease-in-out infinite; }
.ctbar.done .icon-btn { color: #fff; }
@keyframes td-pulse { 50% { filter: brightness(1.25); } }
`;

const SETTINGS_STYLES = `
.dialog.settings { width: min(760px, 96vw); }
.bk-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.bk-actions .btn { flex: 1 1 220px; justify-content: center; min-height: 44px; }
.bk-list { border: 1px solid var(--td-divider); border-radius: var(--td-radius); margin-top: 8px; max-height: 300px; overflow: auto; }
.bk-row { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-top: 1px solid var(--td-divider); flex-wrap: wrap; }
.bk-row:first-child { border-top: none; }
.bk-row .grow { flex: 1 1 200px; min-width: 0; }
.bk-row .grow small { display: block; color: var(--td-muted); overflow-wrap: anywhere; }
.bk-modes { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.bk-modes label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.bk-modes input { margin-top: 3px; }
.bk-upload { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bk-upload input[type=file] { flex: 1 1 220px; min-width: 0; }
.bk-schedule { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 8px; }
.bk-schedule label.inline { display: inline-flex; align-items: center; gap: 6px; margin: 0; }
.bk-schedule input[type=time] { width: 120px; }
.bk-schedule input[type=number] { width: 80px; }
.bk-report { margin-top: 10px; padding: 10px 12px; border-radius: var(--td-radius); background: var(--td-surface); font-size: .9rem; }
.bk-report ul { margin: 6px 0 0; padding-left: 18px; }
.bk-warn { color: var(--td-danger); }
`;

/* ------------------------------------------------------------------ */
/* Wishlist, gifts & price tracker ("Hoard"): constants & styles       */
/* ------------------------------------------------------------------ */

const HOARD_STATUSES = [
  ["idea", "Idea", "mdi:lightbulb-outline"],
  ["watching", "Watching price", "mdi:eye-outline"],
  ["purchased", "Purchased", "mdi:cart-check"],
  ["shipped", "Shipped", "mdi:truck-delivery-outline"],
  ["stashed", "Stashed / hidden", "mdi:archive-lock-outline"],
  ["wrapped", "Wrapped", "mdi:gift-outline"],
  ["gifted", "Gifted", "mdi:party-popper"],
];
const HOARD_WANT_STATUSES = ["idea", "watching", "purchased"];
const HOARD_OWNED = new Set(["purchased", "shipped", "stashed", "wrapped", "gifted"]);
const HOARD_KINDS = [
  ["want", "Want to Buy", "mdi:cart-heart"],
  ["holiday", "Holiday", "mdi:pine-tree"],
  ["birthday", "Birthday or event", "mdi:cake-variant-outline"],
  ["occasion", "Other occasion", "mdi:calendar-star"],
];
const HOARD_SECTION_ICONS = [
  "mdi:cart-heart", "mdi:pine-tree", "mdi:cake-variant-outline", "mdi:pumpkin", "mdi:egg-easter", "mdi:tag-heart-outline",
  "mdi:heart-outline", "mdi:school-outline", "mdi:ring", "mdi:baby-carriage", "mdi:party-popper", "mdi:gift-outline",
  "mdi:calendar-star", "mdi:home-outline", "mdi:tools", "mdi:laptop",
];
const HOARD_PROTECTION = [[14, "14 days"], [30, "30 days"], [0, "No price protection"]];
const HOARD_REVEAL_MS = 120000; // a kiosk re-hides secret gifts after two minutes

const HOARD_STYLES = `
.hoard { display: flex; flex-direction: column; gap: 10px; }
.htools { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
.htools .hscan { background: var(--td-accent); color: var(--text-primary-color, #fff); border: none; border-radius: 22px; padding: 8px 14px; min-height: 44px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; flex: 0 0 auto; }
.htools .hadd { flex: 1 1 auto; display: flex; gap: 4px; min-width: 0; align-items: center; }
@media (max-width: 360px) { .htools .hscan span { display: none; } .htools .hscan { padding: 8px 12px; } }
.hcat { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: var(--td-radius); border: 1px solid var(--td-divider); background: color-mix(in srgb, var(--td-accent) 4%, var(--td-bg)); }
.hcat-head { display: flex; align-items: center; gap: 6px 8px; flex-wrap: wrap; }
.hcat-head > ha-icon { --mdc-icon-size: 20px; color: var(--td-accent); }
.hcat-head .name { font-weight: 700; font-size: 1rem; }
.hcat-head .n { font-size: .75rem; color: var(--td-muted); background: var(--td-surface); border-radius: 10px; padding: 0 8px; }
.hcat-head .grow { flex: 1; }
.hcat-budget { font-size: .8rem; color: var(--td-muted); }
.hcat-budget.over { color: var(--td-danger); font-weight: 600; }
.hcat-add { align-self: flex-start; }
.htools .hadd input { flex: 1; min-width: 0; border-radius: 22px; padding-left: 14px; background: var(--td-surface); border-color: transparent; min-height: 44px; }
.hpills { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 4px; scrollbar-width: thin; }
.hpills .chip { flex: 0 0 auto; }
.hpills .chip ha-icon { --mdc-icon-size: 16px; }
.hpills .chip .n { font-size: .72rem; opacity: .75; }
.hbudget { border: 1px solid var(--td-divider); border-radius: var(--td-radius); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; background: var(--td-bg); }
.hbudget .hrow { display: flex; gap: 8px 14px; align-items: center; flex-wrap: wrap; font-size: .9rem; }
.hbudget .hrow .grow { flex: 1; }
.hbudget .spent { font-weight: 700; font-size: 1rem; }
.hbudget .hbar { height: 8px; border-radius: 4px; background: var(--td-surface); overflow: hidden; }
.hbudget .hbar > span { display: block; height: 100%; background: var(--td-ok); border-radius: 4px; transition: width .25s; }
.hbudget .hbar.over > span { background: var(--td-danger); }
.hbudget .hbar.near > span { background: var(--td-warn); }
.hcount { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: var(--td-accent); }
.hcount ha-icon { --mdc-icon-size: 18px; }
.hhidden { display: flex; gap: 6px; flex-wrap: wrap; }
.hhidden .badge { font-size: .8rem; padding: 4px 10px; background: color-mix(in srgb, var(--td-accent) 10%, transparent); color: var(--td-text); }
.hgroup-head { display: flex; align-items: center; gap: 8px; margin: 8px 2px 2px; font-weight: 600; color: var(--td-muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; }
.hgroup-head ha-icon { --mdc-icon-size: 18px; }
.hgroup-head .grow { flex: 1; }
.hgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 10px; }
.hcard { border: 1px solid var(--td-divider); border-radius: var(--td-radius); padding: 12px; background: var(--td-bg); display: flex; flex-direction: column; gap: 8px; cursor: pointer; min-width: 0; position: relative; }
.hcard:hover { border-color: color-mix(in srgb, var(--td-accent) 55%, var(--td-divider)); }
.hcard.secret { border-style: dashed; }
.hcard.gifted { opacity: .7; }
.hcard.masked { align-items: center; justify-content: center; text-align: center; min-height: 120px; color: var(--td-muted); gap: 4px; }
.hcard.masked .dragon { font-size: 1.8rem; }
.htop { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.hthumb { width: 56px; height: 56px; border-radius: 10px; flex: 0 0 auto; background: var(--td-surface) center / contain no-repeat; display: inline-flex; align-items: center; justify-content: center; color: var(--td-muted); }
.hthumb ha-icon { --mdc-icon-size: 26px; }
.hthumb.lg { width: 84px; height: 84px; }
.htitle { font-weight: 600; line-height: 1.3; word-break: break-word; }
.hsub { display: flex; gap: 4px 6px; flex-wrap: wrap; margin-top: 4px; }
.hnotes { font-size: .85rem; color: var(--td-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.hprices { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.hbest { background: color-mix(in srgb, var(--td-ok) 16%, transparent); color: var(--td-ok); border-radius: 14px; padding: 3px 10px; font-weight: 700; font-size: .9rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.hbest.oos { background: var(--td-surface); color: var(--td-muted); }
.hother { font-size: .8rem; color: var(--td-muted); text-decoration: none; white-space: nowrap; }
.hother:hover, .hbest:hover { text-decoration: underline; }
.hspark { width: 100%; height: 36px; color: var(--td-accent); display: block; }
.hspark.lg { height: 90px; }
.hspark svg { display: block; width: 100%; height: 100%; overflow: visible; }
.hspark .none { font-size: .75rem; color: var(--td-muted); font-style: italic; }
.hfacts { display: flex; gap: 4px 10px; flex-wrap: wrap; font-size: .8rem; color: var(--td-muted); }
.hfacts .good { color: var(--td-ok); font-weight: 600; }
.hfacts .warn { color: color-mix(in srgb, var(--td-warn) 75%, var(--td-text)); font-weight: 600; }
.hnote-box { border-radius: 10px; padding: 8px 10px; font-size: .85rem; display: flex; gap: 8px; align-items: flex-start; background: var(--td-surface); }
.hnote-box ha-icon { --mdc-icon-size: 18px; flex: 0 0 auto; margin-top: 1px; }
.hnote-box.claim { background: color-mix(in srgb, var(--td-warn) 18%, transparent); color: var(--td-text); font-weight: 600; }
.hnote-box.guard { background: color-mix(in srgb, var(--td-ok) 10%, transparent); }
.hnote-box.cool { background: color-mix(in srgb, var(--td-accent) 10%, transparent); }
.hnote-box .grow { flex: 1; min-width: 0; }
.hpipe { display: flex; gap: 3px; align-items: center; }
.hpipe .step { flex: 1; height: 5px; border-radius: 3px; background: var(--td-surface); }
.hpipe .step.done { background: var(--td-accent); }
.hpipe-full { display: flex; flex-wrap: wrap; gap: 6px; }
.hpipe-full button { border: 1px solid var(--td-divider); background: var(--td-bg); border-radius: 16px; padding: 4px 10px; min-height: 34px; display: inline-flex; gap: 4px; align-items: center; font-size: .82rem; }
.hpipe-full button ha-icon { --mdc-icon-size: 16px; }
.hpipe-full button.done { border-color: var(--td-accent); color: var(--td-accent); }
.hpipe-full button.on { background: var(--td-accent); color: var(--text-primary-color, #fff); border-color: var(--td-accent); font-weight: 600; }
.hactions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.hactions .grow { flex: 1; }
.hdeals { border-radius: 10px; background: color-mix(in srgb, #ff7043 10%, transparent); padding: 6px 10px; font-size: .85rem; }
.hdeals summary { cursor: pointer; font-weight: 600; color: #e64a19; list-style: none; display: flex; align-items: center; gap: 6px; }
.hdeals summary::-webkit-details-marker { display: none; }
.hdeal { display: flex; gap: 6px; align-items: center; padding: 6px 0; border-top: 1px solid var(--td-divider); flex-wrap: wrap; }
.hdeal:first-of-type { border-top: none; }
.hdeal .t { flex: 1 1 180px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.hdeal .t a { color: var(--td-text); text-decoration: none; }
.hdeal .t a:hover { text-decoration: underline; }
.hdeal .p { font-weight: 700; }
.hstore-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 4px 10px; align-items: center; padding: 8px 0; border-top: 1px solid var(--td-divider); }
.hstore-row:first-child { border-top: none; }
.hstore-row .name a { font-weight: 600; color: var(--td-text); text-decoration: none; }
.hstore-row .name a:hover { text-decoration: underline; }
.hstore-row .price { font-weight: 700; text-align: right; }
.hstore-row .price.best { color: var(--td-ok); }
.hstore-row .sub { grid-column: 1 / -1; font-size: .75rem; color: var(--td-muted); display: flex; gap: 4px 10px; flex-wrap: wrap; align-items: center; }
.hstore-row .err { color: var(--td-danger); }
.hstore-row details { grid-column: 1 / -1; font-size: .8rem; }
.hstore-row details .hsel { display: flex; gap: 6px; margin-top: 6px; }
.hstore-row details input { flex: 1; min-width: 0; font-family: monospace; font-size: .8rem; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--td-muted); }
.dot.in { background: var(--td-ok); }
.dot.out { background: var(--td-danger); }
.hblock { border-top: 1px solid var(--td-divider); padding-top: 12px; margin-top: 12px; }
.hblock h3 { margin: 0 0 8px; font-size: .95rem; display: flex; align-items: center; gap: 6px; }
.hblock h3 .grow { flex: 1; }
.hinline { display: flex; gap: 6px; flex-wrap: wrap; }
.hinline input { flex: 1 1 160px; min-width: 0; }
.hhist { width: 100%; border-collapse: collapse; font-size: .82rem; }
.hhist td { padding: 4px 6px; border-top: 1px solid var(--td-divider); }
.hhist td.r { text-align: right; font-weight: 600; }
.hverdict { border-radius: 12px; padding: 12px 14px; font-weight: 700; font-size: 1rem; display: flex; gap: 8px; align-items: center; margin: 10px 0; }
.hverdict.buy { background: color-mix(in srgb, var(--td-ok) 16%, transparent); color: var(--td-ok); }
.hverdict.online { background: color-mix(in srgb, var(--td-warn) 20%, transparent); color: color-mix(in srgb, var(--td-warn) 60%, var(--td-text)); }
.hverdict.idle { background: var(--td-surface); color: var(--td-muted); font-weight: 500; font-size: .9rem; }
.hshelf { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.hshelf label { display: flex; flex-direction: column; gap: 4px; font-size: .8rem; color: var(--td-muted); }
.hshelf input.big { font-size: 1.4rem; font-weight: 700; min-height: 52px; }
.honline { margin-top: 4px; }
.hlinks { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.hlinks a { text-decoration: none; }
.hgift { border: 1px dashed var(--td-divider); border-radius: 12px; padding: 10px; margin-top: 10px; }
.hsecret-toggle { display: inline-flex; align-items: center; gap: 6px; }
.btn.danger-text { color: var(--td-danger); }
.hmodel { margin-top: 6px; font-size: .85rem; color: var(--td-muted); }
.hmodel summary { cursor: pointer; }
@media (max-width: 480px) { .hgrid { grid-template-columns: minmax(0, 1fr); } .hshelf { grid-template-columns: 1fr; } }
`;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const STYLES = `
[hidden] { display: none !important; }
:host {
  display: block;
  --td-accent: var(--primary-color, #03a9f4);
  --td-bg: var(--card-background-color, var(--ha-card-background, #fff));
  --td-surface: var(--secondary-background-color, #f4f5f7);
  --td-text: var(--primary-text-color, #212121);
  --td-muted: var(--secondary-text-color, #727272);
  --td-divider: var(--divider-color, rgba(0,0,0,.12));
  --td-danger: var(--error-color, #db4437);
  --td-warn: var(--warning-color, #ffa600);
  --td-ok: var(--success-color, #43a047);
  --td-radius: var(--ha-card-border-radius, 12px);
  --td-tap: 44px;
  color: var(--td-text);
  font-family: var(--paper-font-body1_-_font-family, inherit);
}
* { box-sizing: border-box; }
ha-card { overflow: hidden; display: flex; flex-direction: column; }
:host([panel]) ha-card { border-radius: 0; box-shadow: none; min-height: 100%; background: var(--primary-background-color, var(--td-bg)); }
button { font: inherit; color: inherit; cursor: pointer; }
input, select, textarea { font: inherit; color: var(--td-text); background: var(--td-bg); border: 1px solid var(--td-divider); border-radius: 8px; padding: 8px 10px; min-height: 40px; }
textarea { min-height: 90px; resize: vertical; width: 100%; }
input:focus, select:focus, textarea:focus { outline: 2px solid var(--td-accent); outline-offset: -1px; }
.td-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px 4px; flex-wrap: wrap; position: relative; }
.td-title { font-size: 1.25rem; font-weight: 600; flex: 0 1 auto; display: flex; align-items: center; gap: 8px; min-width: 0; }
.td-emblem { --mdc-icon-size: 28px; opacity: .88; flex: 0 0 auto; }
.td-people { display: flex; gap: 6px; flex-wrap: wrap; }
/* One row that never wraps: the category label shrinks (ellipsis) before the buttons move. */
.td-hrow { display: flex; align-items: center; gap: 8px; flex: 1 1 260px; min-width: 0; }
.td-hrow .td-people { flex-wrap: nowrap; flex: 0 0 auto; }
@media (max-width: 420px) { .td-hrow { gap: 4px; } .td-hrow > .icon-btn { width: 36px; height: 36px; } .td-hrow .td-people { gap: 4px; } }
.avatar { width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: .8rem; font-weight: 600; background-size: cover; background-position: center; flex: 0 0 auto; border: 2px solid transparent; }
.avatar.sm { width: 24px; height: 24px; font-size: .65rem; border-width: 1px; }
.avatar.lg { width: 40px; height: 40px; }
.chip-person { background: none; border: none; padding: 0; position: relative; opacity: .55; }
.chip-person.on { opacity: 1; }
.chip-person.on .avatar { border-color: var(--td-accent); }
.chip-person .home-dot { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: var(--td-ok); border: 2px solid var(--td-bg); }
.icon-btn { background: none; border: none; width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--td-muted); flex: 0 0 auto; }
.icon-btn:hover { background: var(--td-surface); color: var(--td-text); }
.icon-btn.sm { width: 32px; height: 32px; }
.icon-btn.sm ha-icon { --mdc-icon-size: 18px; }
.td-brain { display: flex; gap: 6px; padding: 8px 16px; align-items: center; }
.td-brain input { flex: 1; border-radius: 22px; padding-left: 16px; min-height: 44px; background: var(--td-surface); border-color: transparent; }
.td-brain .icon-btn.mic.on { color: var(--td-danger); animation: pulse 1s infinite; }
.td-brain .send { background: var(--td-accent); color: var(--text-primary-color, #fff); }
@keyframes pulse { 50% { opacity: .4; } }
.td-pick { flex: 0 1 auto; min-width: 0; margin-right: auto; }
.td-picker { max-width: 100%; display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--td-divider); background: var(--td-surface); border-radius: 22px; padding: 6px 8px 6px 12px; min-height: 40px; font-weight: 600; color: var(--td-text); }
.td-picker:hover { border-color: var(--td-accent); }
.td-picker .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.td-picker .count, .menu .count { background: var(--td-accent); color: var(--text-primary-color, #fff); border-radius: 10px; padding: 0 7px; font-size: .75rem; font-weight: 700; flex: 0 0 auto; }
.td-picker .chev { --mdc-icon-size: 20px; color: var(--td-muted); flex: 0 0 auto; }
.menu .count { margin-left: auto; background: var(--td-surface); color: var(--td-muted); }
.menu button.on { background: color-mix(in srgb, var(--td-accent) 12%, transparent); color: var(--td-accent); font-weight: 600; }
.menu button.on .count { background: var(--td-accent); color: var(--text-primary-color, #fff); }
.menu .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu button { min-width: 0; flex: 0 0 auto; }
.menu button > ha-icon { flex: 0 0 auto; }
.menu .lock { --mdc-icon-size: 14px; opacity: .7; }
.menu .sep { height: 1px; background: var(--td-divider); margin: 4px 6px; flex: 0 0 auto; }
.tab { background: none; border: none; padding: 10px 12px; border-radius: 8px 8px 0 0; white-space: nowrap; color: var(--td-muted); display: inline-flex; gap: 6px; align-items: center; border-bottom: 3px solid transparent; }
.tab.on { color: var(--td-accent); border-bottom-color: var(--td-accent); font-weight: 600; }
.tab .count { background: var(--td-surface); border-radius: 10px; padding: 0 7px; font-size: .75rem; color: var(--td-muted); }
.td-filters { display: flex; padding: 0 16px 6px; }
.chip { border: 1px solid var(--td-divider); background: var(--td-bg); border-radius: 16px; padding: 4px 12px; font-size: .85rem; min-height: 32px; display: inline-flex; align-items: center; gap: 4px; }
.chip.on { background: var(--td-accent); border-color: var(--td-accent); color: var(--text-primary-color, #fff); }
.chip.ghost { border-style: dashed; color: var(--td-muted); }
.td-search { flex: 1 1 auto; min-width: 0; border-radius: 18px; min-height: 40px; padding: 6px 14px; }
.td-body { padding: 4px 12px 16px; flex: 1 1 auto; }
.empty { color: var(--td-muted); text-align: center; padding: 28px 12px; font-size: .95rem; }
.empty.sm { padding: 10px 8px; font-size: .85rem; }
.section { margin: 10px 0 4px; }
.section-head { display: flex; align-items: center; gap: 8px; padding: 6px 4px; color: var(--td-muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; flex-wrap: wrap; }
.section-head .grow { flex: 1; }
.section-head button.link, button.link { background: none; border: none; color: var(--td-accent); font-size: .8rem; text-transform: none; letter-spacing: 0; padding: 4px 6px; }
.drop { min-height: 8px; border-radius: 10px; transition: background .15s; }
.drop.over { background: color-mix(in srgb, var(--td-accent) 12%, transparent); outline: 2px dashed var(--td-accent); }
.task-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 6px; border-radius: 10px; background: var(--td-bg); position: relative; }
.task-row + .task-row { border-top: 1px solid var(--td-divider); }
.task-row:hover { background: var(--td-surface); }
.task-row.dragging { opacity: .35; }
.task-row.drop-before { box-shadow: inset 0 3px 0 var(--td-accent); }
.task-row.drop-after { box-shadow: inset 0 -3px 0 var(--td-accent); }
.task-row.done .summary { text-decoration: line-through; color: var(--td-muted); }
.task-row.blocked { opacity: .7; }
.task-row { touch-action: pan-y; }
.task-row.swiping > *, .task-row.swipe-settle > * { transform: translateX(var(--swipe, 0px)); }
.task-row.swipe-settle > * { transition: transform .18s ease-out; }
.task-row.swipe-right { background: linear-gradient(to right, var(--td-ok) var(--swipe-abs, 0px), transparent var(--swipe-abs, 0px)); }
.task-row.swipe-left { background: linear-gradient(to left, var(--td-danger) var(--swipe-abs, 0px), transparent var(--swipe-abs, 0px)); }
.task-row.swipe-right::before, .task-row.swipe-left::before { content: attr(data-swipe-label); position: absolute; top: 50%; transform: translateY(-50%); color: #fff; font-weight: 600; font-size: .85rem; pointer-events: none; white-space: nowrap; }
.task-row.swipe-right::before { left: 14px; }
.task-row.swipe-left::before { right: 14px; }
.task-row.swipe-armed::before { font-size: .95rem; }
.icon-btn.on { color: var(--td-accent); background: color-mix(in srgb, var(--td-accent) 12%, transparent); }
.remind-row { display: grid; grid-template-columns: minmax(0, 1fr) 124px; gap: 10px; align-items: end; }
.remind-hint { margin-top: -4px; }
.handle { cursor: grab; color: var(--td-muted); touch-action: none; width: 22px; height: 36px; display: inline-flex; align-items: center; justify-content: center; background: none; border: none; padding: 0; opacity: .5; flex: 0 0 auto; }
.task-row:hover .handle { opacity: 1; }
.check { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--td-muted); background: none; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; margin-top: 4px; padding: 0; }
.check.on { background: var(--td-ok); border-color: var(--td-ok); color: #fff; }
.check.prio-high { border-color: var(--td-warn); }
.check.prio-urgent { border-color: var(--td-danger); }
.check:disabled { opacity: .4; cursor: not-allowed; }
.task-main { flex: 1 1 auto; min-width: 0; cursor: pointer; padding-top: 2px; }
.summary { font-size: 1rem; line-height: 1.35; word-break: break-word; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 3px; align-items: center; }
.badge { font-size: .72rem; border-radius: 10px; padding: 1px 8px; background: var(--td-surface); color: var(--td-muted); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; text-decoration: none; }
.badge ha-icon { --mdc-icon-size: 14px; }
.badge.overdue, .badge.urgent, .badge.expired { background: color-mix(in srgb, var(--td-danger) 16%, transparent); color: var(--td-danger); }
.badge.today, .badge.high { background: color-mix(in srgb, var(--td-warn) 18%, transparent); color: color-mix(in srgb, var(--td-warn) 70%, var(--td-text)); }
.badge.streak { background: color-mix(in srgb, #ff7043 16%, transparent); color: #e64a19; }
.badge.ok { background: color-mix(in srgb, var(--td-ok) 16%, transparent); color: var(--td-ok); }
.badge.plan { background: none; border: 1px solid var(--td-divider); }
.lastdone { font-size: .74rem; color: var(--td-muted); font-style: italic; }
.progress { height: 4px; background: var(--td-surface); border-radius: 2px; overflow: hidden; width: 70px; display: inline-block; vertical-align: middle; }
.progress > span { display: block; height: 100%; background: var(--td-ok); transition: width .2s; }
.progress.wide { width: 100%; height: 6px; margin-top: 6px; }
.assignees { display: flex; gap: 2px; flex: 0 0 auto; padding-top: 4px; }
.row-actions { display: flex; gap: 0; flex: 0 0 auto; }
.row-actions .icon-btn { width: 34px; height: 34px; }
.claim { border: 1px solid var(--td-accent); color: var(--td-accent); background: none; border-radius: 14px; padding: 2px 10px; font-size: .8rem; margin-top: 4px; }
.details { margin: 6px 0 2px; font-size: .9rem; color: var(--td-text); }
.details p { margin: 4px 0; }
.details ul { margin: 4px 0; padding-left: 20px; }
.subtasks { margin-top: 6px; display: flex; flex-direction: column; gap: 2px; }
.subtask { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
.subtask .check { width: 20px; height: 20px; margin: 0; }
.subtask.done span { text-decoration: line-through; color: var(--td-muted); }
.subtask input { flex: 1; min-height: 32px; padding: 4px 8px; font-size: .9rem; }
.quick { border: 1px solid var(--td-accent); border-radius: var(--td-radius); padding: 6px 8px; margin: 6px 0 12px; background: color-mix(in srgb, var(--td-accent) 5%, var(--td-bg)); }
.quick .section-head { color: var(--td-accent); }
.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.col { background: var(--td-surface); border-radius: var(--td-radius); padding: 8px; display: flex; flex-direction: column; min-height: 200px; }
.col-head { display: flex; align-items: center; gap: 10px; padding: 6px 6px 10px; font-weight: 600; }
.col-head .sub { font-weight: 400; font-size: .8rem; color: var(--td-muted); }
.col .drop { flex: 1; background: transparent; }
.col .task-row { background: var(--td-bg); margin-bottom: 6px; border-top: none !important; box-shadow: 0 1px 2px rgba(0,0,0,.06); flex-wrap: wrap; row-gap: 0; }
.col .task-main { flex: 1 1 calc(100% - 70px); }
.col .assignees { margin-left: auto; padding-top: 0; align-items: center; }
.col .row-actions .icon-btn { width: 30px; height: 30px; }
.col .task-row.drop-before { box-shadow: inset 0 3px 0 var(--td-accent); }
.col .task-row.drop-after { box-shadow: inset 0 -3px 0 var(--td-accent); }
:host([kiosk]) .summary { font-size: 1.1rem; }
:host([kiosk]) .check { width: 32px; height: 32px; }
.kanban { display: grid; grid-template-columns: repeat(4, minmax(200px, 1fr)); gap: 10px; overflow-x: auto; }
.shop-add, .inline-add { display: flex; gap: 6px; margin: 8px 0; position: relative; flex-wrap: wrap; }
.shop-add input, .inline-add input { flex: 1 1 180px; min-height: 46px; }
.inline-add.compact input { min-height: 38px; }
.inline-add select { flex: 0 1 170px; min-width: 0; }
.btn { background: var(--td-accent); color: var(--text-primary-color, #fff); border: none; border-radius: 8px; padding: 8px 14px; min-height: 40px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
.btn.flat { background: var(--td-surface); color: var(--td-text); }
.btn.danger { background: var(--td-danger); }
.btn.small { min-height: 32px; padding: 4px 10px; font-size: .85rem; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.aisle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.tile { border: 1px solid var(--td-divider); background: var(--td-bg); border-radius: 12px; min-height: 64px; padding: 10px 12px; text-align: left; display: flex; flex-direction: column; justify-content: center; gap: 2px; position: relative; touch-action: manipulation; }
.tile .name { font-weight: 500; font-size: 1rem; line-height: 1.2; padding-right: 22px; overflow-wrap: anywhere; }
.tile .qty { font-size: .8rem; color: var(--td-muted); }
.tile.done { opacity: .5; }
.tile.done .name { text-decoration: line-through; }
.tile .edit { position: absolute; top: 2px; right: 2px; width: 28px; height: 28px; }
.history { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 2px 10px; }
.history .chip small { color: var(--td-muted); }
.bom { border: 1px solid var(--td-divider); border-radius: var(--td-radius); padding: 6px 10px; margin: 8px 0 12px; }
.bom table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.bom td { padding: 4px; border-top: 1px solid var(--td-divider); }
.bom td.n { width: 1%; white-space: nowrap; }
.bom tr.acquired td { color: var(--td-muted); text-decoration: line-through; }
.seg { display: inline-flex; border: 1px solid var(--td-divider); border-radius: 18px; overflow: hidden; flex: 0 0 auto; }
.seg button { border: none; background: none; padding: 6px 12px; font-size: .85rem; min-height: 36px; display: inline-flex; align-items: center; gap: 6px; }
.seg button.on { background: var(--td-accent); color: var(--text-primary-color, #fff); }
.seg button.on.in_stock { background: var(--td-ok); }
.seg button.on.low { background: var(--td-warn); }
.seg button.on.out { background: var(--td-danger); }
.seg ha-icon { --mdc-icon-size: 18px; }
.pantry-row { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-top: 1px solid var(--td-divider); flex-wrap: wrap; }
.pantry-row .grow { flex: 1 1 140px; min-width: 0; }
.scope-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 8px 0 4px; }
.scope-bar .note { font-size: .8rem; color: var(--td-muted); display: inline-flex; align-items: center; gap: 4px; }
.scope-bar .note ha-icon { --mdc-icon-size: 16px; }
.quick-add { display: flex; gap: 6px; margin: 8px 0 12px; flex-wrap: wrap; }
.quick-add input { flex: 1 1 220px; min-height: 48px; font-size: 1rem; border-radius: 24px; padding-left: 16px; }
.quick-add select { flex: 0 1 180px; min-width: 0; max-width: 45%; border-radius: 24px; }
.quick-add .btn { border-radius: 24px; min-height: 48px; }
.qsection, .trip-card { border: 1px solid var(--td-divider); border-radius: var(--td-radius); margin: 10px 0; background: var(--td-bg); overflow: hidden; }
.qs-head, .trip-head { display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 2px; min-height: 48px; }
.qs-head.inbox { background: color-mix(in srgb, var(--td-accent) 5%, var(--td-bg)); }
.collapse-btn { background: none; border: none; display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; text-align: left; padding: 6px 4px; min-height: 40px; }
.collapse-btn .chev { transition: transform .15s; color: var(--td-muted); flex: 0 0 auto; }
.collapse-btn.closed .chev { transform: rotate(-90deg); }
.collapse-btn .title { font-weight: 600; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.collapse-btn .badge { flex: 0 0 auto; }
.qs-body { padding: 0 8px 6px; }
.qs-body .task-row:first-child { border-top: 1px solid var(--td-divider); border-radius: 0; }
.qs-actions { display: flex; gap: 0; flex: 0 0 auto; }
.rename-input { flex: 1; min-height: 36px; font-weight: 600; }
.trip-head { flex-wrap: wrap; padding: 6px 8px 8px 2px; align-items: flex-start; }
.trip-head .collapse-btn { align-items: flex-start; }
.trip-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
.trip-info .sub { font-size: .82rem; color: var(--td-muted); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.status-chip { font-size: .7rem; border-radius: 10px; padding: 1px 8px; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; background: var(--td-surface); color: var(--td-muted); }
.status-chip.active { background: color-mix(in srgb, var(--td-ok) 18%, transparent); color: var(--td-ok); }
.status-chip.upcoming { background: color-mix(in srgb, var(--td-accent) 15%, transparent); color: var(--td-accent); }
.trip-progress { font-size: .85rem; font-weight: 600; white-space: nowrap; }
.trip-card.master { border-style: dashed; }
.trip-body { padding: 0 10px 8px; }
.pack-group { margin: 4px 0 8px; }
.pack-group-head { display: flex; align-items: center; gap: 6px; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--td-muted); font-weight: 600; }
.pack-group-head .collapse-btn .title { font-size: .78rem; }
.pack-row { display: flex; align-items: center; gap: 10px; padding: 4px 4px; border-radius: 10px; min-height: 52px; }
.pack-row + .pack-row { border-top: 1px solid var(--td-divider); }
.pack-row.task-row { padding: 4px; }
.pack-check { width: 40px; height: 40px; border-radius: 10px; border: 2px solid var(--td-muted); background: none; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; padding: 0; transition: background .12s; }
.pack-check.on { background: var(--td-ok); border-color: var(--td-ok); color: #fff; }
.pack-check ha-icon { --mdc-icon-size: 24px; }
.pack-name { flex: 1 1 auto; min-width: 0; font-size: 1rem; word-break: break-word; transition: opacity .12s; cursor: pointer; }
.pack-row.done .pack-name { text-decoration: line-through; opacity: .5; }
.icon-btn.repeat.on { color: var(--td-accent); background: color-mix(in srgb, var(--td-accent) 12%, transparent); }
.td-bulkbar { position: sticky; bottom: 0; display: flex; gap: 6px; padding: 8px 12px; background: var(--td-bg); border-top: 1px solid var(--td-divider); flex-wrap: wrap; align-items: center; }
.td-bulkbar select { min-height: 36px; padding: 4px 8px; }
.sel { width: 22px; height: 22px; margin-top: 6px; accent-color: var(--td-accent); }
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 9; display: flex; align-items: flex-end; justify-content: center; }
@media (min-width: 640px) { .backdrop { align-items: center; } }
.dialog { background: var(--td-bg); color: var(--td-text); width: min(640px, 100vw); max-height: 92vh; overflow: auto; border-radius: 16px 16px 0 0; padding: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
@media (min-width: 640px) { .dialog { border-radius: 16px; } }
.dialog h2 { margin: 0 0 12px; font-size: 1.15rem; display: flex; align-items: center; gap: 8px; }
.dialog h2 .grow { flex: 1; }
.dialog .hint { font-size: .85rem; color: var(--td-muted); margin: -4px 0 12px; }
.dialog .banner { font-size: .9rem; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--td-accent) 10%, transparent); margin: 0 0 12px; display: flex; gap: 8px; align-items: center; }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
.form .full { grid-column: 1 / -1; }
.form label { display: flex; flex-direction: column; gap: 4px; font-size: .8rem; color: var(--td-muted); }
.form label.inline { flex-direction: row; align-items: center; gap: 8px; font-size: .9rem; color: var(--td-text); }
.form input[type=checkbox], .form input[type=radio] { min-height: auto; width: 18px; height: 18px; }
.form .field { display: flex; flex-direction: column; gap: 6px; font-size: .8rem; color: var(--td-muted); }
.form .field > span:not(.lastdone) { color: var(--td-text); font-size: .9rem; }
.choice-grid label { text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--td-divider); background: var(--td-bg); min-height: 56px; display: flex; flex-direction: row; gap: 10px; align-items: center; color: var(--td-text); font-size: .9rem; cursor: pointer; }
.choice-grid label small { display: block; color: var(--td-muted); font-size: .75rem; }
.choice-grid label input { margin: 0; flex: 0 0 auto; }
.choice-grid label:has(input:checked) { border-color: var(--td-accent); box-shadow: inset 0 0 0 1px var(--td-accent); background: color-mix(in srgb, var(--td-accent) 6%, var(--td-bg)); }
@media (max-width: 480px) { .form { grid-template-columns: 1fr; } }
.toggle-group { display: flex; gap: 6px; flex-wrap: wrap; }
.picklist { max-height: 160px; overflow: auto; border: 1px solid var(--td-divider); border-radius: 8px; padding: 4px 8px; }
.picklist label { flex-direction: row; align-items: center; gap: 8px; color: var(--td-text); font-size: .9rem; padding: 3px 0; }
.dialog-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; flex-wrap: wrap; }
.dialog-actions .grow { flex: 1; }
.snooze-grid, .choice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; margin-bottom: 14px; }
.snooze-grid button, .choice-grid button { text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--td-divider); background: var(--td-bg); min-height: 56px; display: flex; gap: 10px; align-items: center; }
.snooze-grid button small, .choice-grid button small { display: block; color: var(--td-muted); font-size: .75rem; }
.snooze-grid button:hover, .choice-grid button:hover { border-color: var(--td-accent); }
.choice-grid button.on { border-color: var(--td-accent); box-shadow: inset 0 0 0 1px var(--td-accent); background: color-mix(in srgb, var(--td-accent) 6%, var(--td-bg)); }
.choice-grid.wide { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 4px; max-height: 136px; overflow: auto; border: 1px solid var(--td-divider); border-radius: 8px; padding: 4px; }
.icon-grid button { border: 1px solid transparent; background: none; border-radius: 8px; height: 40px; display: inline-flex; align-items: center; justify-content: center; color: var(--td-muted); }
.icon-grid button.on { border-color: var(--td-accent); color: var(--td-accent); background: color-mix(in srgb, var(--td-accent) 10%, transparent); }
.icon-field { display: flex; gap: 8px; align-items: center; }
.icon-field input { flex: 1; }
.icon-preview { width: 40px; height: 40px; border-radius: 10px; background: var(--td-surface); display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.cat-row { display: flex; align-items: center; gap: 6px; padding: 4px 2px; border-top: 1px solid var(--td-divider); min-height: 48px; }
.cat-row .name { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-row.hidden-tab .name { opacity: .45; }
.cat-row .lock { --mdc-icon-size: 16px; color: var(--td-muted); }
.history-list { font-size: .85rem; color: var(--td-muted); margin: 6px 0 0; padding-left: 18px; }
.td-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #323232; color: #fff; border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 14px; z-index: 10; max-width: calc(100vw - 32px); box-shadow: 0 6px 24px rgba(0,0,0,.35); font-size: .92rem; }
.td-toast button { background: none; border: none; color: var(--td-accent); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 6px; }
.ghost-drag { position: fixed; pointer-events: none; z-index: 11; opacity: .9; transform: rotate(1.5deg); box-shadow: 0 8px 24px rgba(0,0,0,.25); border-radius: 10px; background: var(--td-bg); max-width: 360px; }
.menu { position: fixed; right: 12px; top: 56px; white-space: nowrap; overflow-y: auto; background: var(--td-bg); border: 1px solid var(--td-divider); border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.18); z-index: 9999; display: flex; flex-direction: column; min-width: 220px; padding: 4px; }
.menu button { background: none; border: none; text-align: left; padding: 10px 12px; border-radius: 8px; display: flex; gap: 10px; align-items: center; }
.menu button:hover { background: var(--td-surface); }
.mealie-status { font-size: .75rem; color: var(--td-muted); background: none; border: 1px solid var(--td-divider); border-radius: 12px; padding: 2px 8px; font-weight: 500; white-space: nowrap; }
.mealie-status:hover { color: var(--td-accent); border-color: var(--td-accent); }
.mealie-status.bad { color: var(--td-danger); }
.error { color: var(--td-danger); padding: 16px; }
`;

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

class TaskDragonCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._board = null;
    this._loadError = null;
    this._idx = null;
    this._ui = {
      tab: null,
      search: "",
      people: new Set(),
      kanbanMode: "kanban",
      expanded: new Set(),
      selected: new Set(),
      bulk: false,
      showDone: new Set(),
      allMine: false,
      showHistory: false,
      menu: false,
      planMenu: false,
      shop: {},
      recipes: { category: "", sort: "az", query: "" },
      quickScope: storage.get("taskdragon.quickScope", "shared") === "private" ? "private" : "shared",
      renaming: null,
      maint: {
        view: "dashboard",
        taskId: null,
        objectId: null,
        search: false,
        query: "",
        filter: "all",
        user: "all",
        priority: "all",
        sort: "due",
        group: "none",
        area: null,
        select: false,
        selected: new Set(),
        addMenu: false,
        headMenu: false,
        taskTab: "overview",
        open: {},
        docCat: "manual",
        histTask: "",
        histFrom: "",
        histTo: "",
        calMonth: null,
      },
    };
    this._dialog = null;
    this._toast = null;
    this._history = {};
    this._drag = null;
    this._shellReady = false;
    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onInput = this._onInput.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onSwipeMove = this._onSwipeMove.bind(this);
    this._onSwipeEnd = this._onSwipeEnd.bind(this);
    this._onViewport = () => this._placeMenus(this.shadowRoot);
  }

  /* ---------------- Lovelace API ---------------- */

  static getStubConfig() {
    return { view_mode: "quick" };
  }

  static getConfigElement() {
    return document.createElement("taskdragon-card-editor");
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (config.view_mode && !VIEW_MODES.includes(config.view_mode)) {
      throw new Error(`view_mode must be one of ${VIEW_MODES.join(", ")}`);
    }
    this._config = { view_mode: "quick", show_brain_dump: true, ...config };
    this.toggleAttribute("kiosk", this._config.view_mode === "kiosk_split");
    this._ui.tab = this._config.plan || null;
    if (this._shellReady) {
      this._buildShell();
      this._render();
    }
  }

  getCardSize() {
    return 10;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto", min_rows: 6 };
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!previous) {
      this._connect();
      return;
    }
    // Re-render only when something we display from hass.states changed.
    if (this._board && this._watchedStatesChanged(previous, hass)) {
      this._renderChrome();
      this._renderBody();
    }
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (this._hass && !this._unsub) this._connect();
    // Menus are position:fixed; keep them glued to their button while the page scrolls.
    window.addEventListener("resize", this._onViewport);
    window.addEventListener("scroll", this._onViewport, { capture: true, passive: true });
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
    this._unsub = null;
    // Never leave the camera, a wake lock or kitchen timers running for a card that is gone.
    this._scanStop();
    if (this._dialog?.kind === "cook") this._cookClosed(this._dialog);
    clearTimeout(this._maintPoll);
    window.removeEventListener("resize", this._onViewport);
    window.removeEventListener("scroll", this._onViewport, { capture: true });
  }

  _watchedStatesChanged(prev, next) {
    const watched = (this._board?.people || []).map((p) => p.entity_id);
    for (const task of this._board?.tasks || []) if (task.sensor_entity_id) watched.push(task.sensor_entity_id);
    return watched.some((entityId) => prev.states[entityId] !== next.states[entityId]);
  }

  _connect() {
    if (!this._hass || this._unsub) return;
    if (!this._shellReady) this._buildShell();
    this._store = TaskDragonStore.for(this._hass);
    this._unsub = this._store.subscribe((board, error) => {
      this._board = board;
      this._loadError = error;
      this._index();
      this._render();
      this._refreshDialogSubtasks();
      if (!board) return;
      // Anything changed server-side: refresh the open maintenance view too.
      const tab = this._currentTab();
      if (this._idx.plans.get(tab)?.archetype === "home_maintenance" && this._maintData(tab)) this._queueMaintLoad(tab);
      if (this._idx.plans.get(tab)?.archetype === "wishlist_hoard" && this._hData(tab)) this._queueHoardLoad(tab);
      this._mDeepLink();
      this._hDeepLink();
      this._tDeepLink();
    });
  }

  /* ---------------- Data helpers ---------------- */

  _index() {
    const b = this._board;
    if (!b) {
      this._idx = null;
      return;
    }
    const plans = new Map(b.plans.map((p) => [p.id, p]));
    const tasks = new Map(b.tasks.map((t) => [t.uid, t]));
    const children = new Map();
    const byPlan = new Map();
    for (const task of b.tasks) {
      if (task.parent_uid) {
        if (!children.has(task.parent_uid)) children.set(task.parent_uid, []);
        children.get(task.parent_uid).push(task);
      } else {
        if (!byPlan.has(task.plan_id)) byPlan.set(task.plan_id, []);
        byPlan.get(task.plan_id).push(task);
      }
    }
    for (const list of [...children.values(), ...byPlan.values()]) list.sort((a, b2) => a.position - b2.position);
    const people = new Map((b.people || []).map((p) => [p.entity_id, p]));
    const sections = new Map();
    for (const section of b.sections || []) {
      if (!sections.has(section.plan_id)) sections.set(section.plan_id, []);
      sections.get(section.plan_id).push(section);
    }
    for (const list of sections.values()) list.sort((a, b2) => a.position - b2.position);
    const trips = new Map();
    for (const trip of b.trips || []) {
      if (!trips.has(trip.plan_id)) trips.set(trip.plan_id, []);
      trips.get(trip.plan_id).push(trip);
    }
    const quickIds = new Set([b.quick?.shared, b.quick?.private].filter(Boolean));
    this._idx = { plans, tasks, children, byPlan, people, sections, trips, quickIds };
  }

  _prefs() {
    const prefs = this._board?.prefs || {};
    return { hidden_tabs: prefs.hidden_tabs || [], tab_order: prefs.tab_order || [], collapsed: prefs.collapsed || [] };
  }

  _isCollapsed(key) {
    return this._prefs().collapsed.includes(key);
  }

  _isAdmin() {
    return !!this._board?.user?.is_admin;
  }

  _activePlans() {
    return (this._board?.plans || []).filter((p) => !p.archived);
  }

  _visiblePlans() {
    if (!this._board) return [];
    let plans = this._activePlans();
    const wanted = this._config.plans;
    if (Array.isArray(wanted) && wanted.length) {
      const keys = wanted.map((w) => String(w).toLowerCase());
      plans = plans.filter((p) => keys.includes(p.id.toLowerCase()) || keys.includes(p.name.toLowerCase()));
    }
    if (this._config.plan) plans = plans.filter((p) => p.id === this._config.plan || p.name === this._config.plan);
    return plans;
  }

  /** Every top-level tab in the user's order, hidden ones included. */
  _allTabs() {
    if (!this._board) return [];
    const tabs = [];
    if (this._board.quick?.shared || this._board.quick?.private) {
      tabs.push({ key: "quick", label: "Quick List", icon: "mdi:lightning-bolt-outline" });
    }
    tabs.push({ key: "myday", label: "My Day", icon: "mdi:white-balance-sunny" });
    tabs.push({ key: "family", label: "Family", icon: "mdi:account-group" });
    for (const plan of this._visiblePlans()) {
      if (this._idx.quickIds.has(plan.id)) continue; // shown inside the Quick List tab
      tabs.push({ key: plan.id, label: plan.name, icon: plan.icon || ARCHETYPES[plan.archetype]?.icon || "mdi:format-list-checks", plan });
    }
    const order = this._prefs().tab_order;
    const rank = (key) => {
      const index = order.indexOf(key);
      return index === -1 ? order.length : index;
    };
    return tabs.map((tab, index) => ({ ...tab, index })).sort((a, b) => rank(a.key) - rank(b.key) || a.index - b.index);
  }

  _shownTabs() {
    const hidden = new Set(this._prefs().hidden_tabs);
    return this._allTabs().filter((tab) => !hidden.has(tab.key));
  }

  _me() {
    return this._config.person || this._board?.me || null;
  }

  _mode() {
    const mode = this._config.view_mode;
    if (mode === "auto") return this._me() ? "personal" : "kiosk_split";
    return mode;
  }

  _defaultTab() {
    if (this._config.plan) {
      const plan = this._visiblePlans()[0];
      return plan ? plan.id : "myday";
    }
    const shown = this._shownTabs().map((t) => t.key);
    const mode = this._mode();
    const wanted = mode === "kiosk_split" ? "family" : mode === "personal" ? "myday" : "quick";
    if (shown.includes(wanted)) return wanted;
    return shown[0] || "myday";
  }

  _currentTab() {
    const tab = this._ui.tab || this._defaultTab();
    if (this._config.plan) return this._idx?.plans.has(tab) ? tab : this._defaultTab();
    if (["quick", "myday", "family"].includes(tab)) return tab;
    return this._idx?.plans.has(tab) && !this._idx.plans.get(tab).archived ? tab : this._defaultTab();
  }

  _person(entityId) {
    return this._idx?.people.get(entityId) || { entity_id: entityId, name: entityId?.split(".")[1] || "?" };
  }

  _today() {
    return this._board?.today || localISODate(new Date());
  }

  _isPool(task) {
    return !task.assigned_to || !task.assigned_to.length;
  }

  _planOf(task) {
    return this._idx?.plans.get(task.plan_id) || {};
  }

  _isActionable(task) {
    const plan = this._planOf(task);
    return ACTIONABLE.has(plan.archetype) && !plan.is_template && !plan.archived;
  }

  _quickPlanId() {
    const quick = this._board?.quick || {};
    return this._ui.quickScope === "private" ? quick.private || quick.shared : quick.shared || quick.private;
  }

  _matchesSearch(task) {
    const q = this._ui.search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [task.summary, task.description, task.category, ...(task.context_tags || [])].join(" ").toLowerCase();
    if (haystack.includes(q)) return true;
    return (this._idx.children.get(task.uid) || []).some((c) => c.summary.toLowerCase().includes(q));
  }

  _visible(task) {
    if (task.status === "snoozed") return false;
    if (task.status === "blocked" && task.hide_when_blocked) return false;
    return this._matchesSearch(task);
  }

  _isTodayRelevant(task) {
    const today = this._today();
    if (task.status === "completed") return !!task.completed_at && localISODate(new Date(task.completed_at)) === localISODate(new Date());
    if (task.status === "in_process") return true;
    if (task.expires_at) return true;
    if (task.due_date) return task.due_date <= today;
    return this._planOf(task).archetype === "daily_chores";
  }

  _subProgress(task) {
    const kids = this._idx.children.get(task.uid) || [];
    if (!kids.length) return null;
    return { done: kids.filter((k) => k.status === "completed").length, total: kids.length };
  }

  _sortTasks(list) {
    const today = this._today();
    return [...list].sort((a, b) => {
      const doneA = a.status === "completed" ? 1 : 0;
      const doneB = b.status === "completed" ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      const overdueA = a.due_date && a.due_date < today ? 0 : 1;
      const overdueB = b.due_date && b.due_date < today ? 0 : 1;
      if (overdueA !== overdueB) return overdueA - overdueB;
      const prio = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      if (prio) return prio;
      const dueA = a.due_datetime || a.due_date || "9999";
      const dueB = b.due_datetime || b.due_date || "9999";
      if (dueA !== dueB) return dueA < dueB ? -1 : 1;
      return a.position - b.position;
    });
  }

  /* ---------------- Shell ---------------- */

  _buildShell() {
    const root = this.shadowRoot;
    if (this._scan) this._scanStop(); // the camera overlay lives in the shell being replaced
    const style = document.createElement("style");
    style.textContent = STYLES + MAINT_STYLES + RECIPE_STYLES + SCAN_STYLES + COOK_STYLES + SETTINGS_STYLES + HOARD_STYLES;
    const container = document.createElement("div");
    setHTML(
      container,
      html`<ha-card>
        <div class="td-header"></div>
        <div class="td-brain" ${this._config.show_brain_dump ? "" : html`hidden`}>
          <input class="brain-input" type="text" maxlength="4000" placeholder="Brain dump… “pick up 2x4s Saturday morning and add garlic powder to groceries”" enterkeyhint="send" aria-label="Brain dump">
          <button class="icon-btn mic" data-action="brain-mic" title="Speak"><ha-icon icon="mdi:microphone"></ha-icon></button>
          <button class="icon-btn send" data-action="brain-send" title="Add"><ha-icon icon="mdi:send"></ha-icon></button>
        </div>
        <div class="td-filters" hidden>
          <input class="td-search" type="search" placeholder="Search this list" aria-label="Search" enterkeyhint="search">
        </div>
        <div class="td-body"></div>
        <div class="td-bulkbar" hidden></div>
      </ha-card>
      <div class="td-dialog-host"></div>
      <div class="td-toast-host"></div>
      <div class="td-scan-host"></div>`,
    );
    root.replaceChildren(style, ...container.childNodes);
    if (!this._listening) {
      root.addEventListener("click", this._onClick);
      root.addEventListener("keydown", this._onKeyDown);
      root.addEventListener("input", this._onInput);
      root.addEventListener("change", this._onChange);
      root.addEventListener("pointerdown", this._onPointerDown);
      this._listening = true;
    }
    root.querySelector(".td-search").value = this._ui.search;
    this._shellReady = true;
  }

  _render() {
    if (!this._shellReady) this._buildShell();
    if (!this._board) {
      setHTML(
        this.shadowRoot.querySelector(".td-body"),
        this._loadError ? html`<div class="error">TaskDragon is unavailable: ${this._loadError}</div>` : html`<div class="empty">Loading TaskDragon…</div>`,
      );
      return;
    }
    this._renderChrome();
    this._renderBody();
    this._renderBulkBar();
  }

  _renderChrome() {
    const root = this.shadowRoot;
    const tab = this._currentTab();
    const title = this._config.title ?? (this._config.plan ? this._visiblePlans()[0]?.name || "TaskDragon" : "TaskDragon");
    const hoardTab = this._idx.plans.get(tab)?.archetype === "wishlist_hoard";
    const searching = !!(this._ui.searchOpen || this._ui.search);
    const people = this._board.people || [];
    const peopleHtml = people.map((p) => {
      const on = this._ui.people.size ? this._ui.people.has(p.entity_id) : tab === "myday" ? p.entity_id === this._me() : true;
      const home = this._hass?.states[p.entity_id]?.state === "home";
      return html`<button class="chip-person ${on ? "on" : ""}" data-action="person-chip" data-id="${p.entity_id}" title="${p.name}">
        ${this._avatar(p, "")}${home ? html`<span class="home-dot"></span>` : ""}</button>`;
    });
    const mealie = this._board.mealie?.enabled
      ? html`<button class="mealie-status ${this._board.mealie.ok === false ? "bad" : ""}" data-action="r-open-browser" title="${this._board.mealie.ok === false ? this._board.mealie.error || "Mealie is unreachable" : "Browse Mealie recipes"}">${this._board.mealie.ok === false ? "⚠ Mealie" : "Mealie ✓"}</button>`
      : "";
    setHTML(
      root.querySelector(".td-header"),
      html`<div class="td-title"><ha-icon class="td-emblem" icon="taskdragon:dragon"></ha-icon>${title} ${mealie}</div>
        <div class="td-hrow">
          ${this._config.plan ? html`<span class="td-pick"></span>` : this._planPickerHtml(tab)}
          <div class="td-people">${peopleHtml}</div>
          <button class="icon-btn ${searching ? "on" : ""}" data-action="search-toggle" title="Search" aria-label="Search" aria-expanded="${searching ? "true" : "false"}"><ha-icon icon="mdi:magnify"></ha-icon></button>
          ${hoardTab ? "" : html`<button class="icon-btn" data-action="s-open" data-context="auto" title="Scan a barcode" aria-label="Scan a barcode"><ha-icon icon="mdi:barcode-scan"></ha-icon></button>`}
          <button class="icon-btn" data-action="menu" title="More" aria-label="More"><ha-icon icon="mdi:dots-vertical"></ha-icon></button>
          ${this._ui.menu ? this._menuHtml() : ""}
        </div>`,
    );
    this._placeMenus(root.querySelector(".td-header"));
    root.querySelector(".td-brain").hidden = !this._config.show_brain_dump || hoardTab;
    root.querySelector(".td-filters").hidden = !searching;
  }

  /** Open (not done, not snoozed) items for a category, or null where a count means nothing. */
  _tabCount(tab) {
    const open = (planId) => (this._idx.byPlan.get(planId) || []).filter((t) => t.status !== "completed" && t.status !== "snoozed").length;
    if (tab.plan) {
      if (tab.plan.archetype === "home_maintenance") return this._maintCount(tab.key);
      if (tab.plan.archetype === "wishlist_hoard") return this._hData(tab.key) ? this._hAttention(this._hData(tab.key)) || null : null;
      if (tab.plan.archetype === "pantry_spices" || tab.plan.archetype === "packing_trips") return null;
      return open(tab.key);
    }
    if (tab.key === "quick") return open(this._quickPlanId());
    if (tab.key === "myday") {
      const me = this._me();
      if (!me) return null;
      return this._board.tasks.filter(
        (t) => !t.parent_uid && this._isActionable(t) && t.status !== "completed" && t.status !== "snoozed" && t.assigned_to.includes(me) && this._isTodayRelevant(t),
      ).length;
    }
    return null;
  }

  _planPickerHtml(tab) {
    const tabs = this._shownTabs();
    const current = this._allTabs().find((t) => t.key === tab) || tabs[0];
    const count = current ? this._tabCount(current) : null;
    const menu = this._ui.planMenu
      ? html`<div class="menu td-planmenu" role="menu" aria-label="Categories">
          ${tabs.map((t) => {
            const c = this._tabCount(t);
            return html`<button class="${t.key === tab ? "on" : ""}" data-action="tab" data-id="${t.key}" role="menuitem"><ha-icon icon="${t.icon}"></ha-icon><span class="grow">${t.label}</span>${t.plan?.is_private ? html`<ha-icon class="lock" icon="mdi:lock-outline" title="Private"></ha-icon>` : ""}${c !== null ? html`<span class="count">${c}</span>` : ""}</button>`;
          })}
          <div class="sep" role="separator"></div>
          <button data-action="plan-new" role="menuitem"><ha-icon icon="mdi:plus"></ha-icon>New category / plan</button>
          <button data-action="categories" role="menuitem"><ha-icon icon="mdi:eye-settings-outline"></ha-icon>Show / hide categories</button>
        </div>`
      : "";
    return html`<span class="td-pick"><button class="td-picker" data-action="plan-menu" aria-haspopup="menu" aria-expanded="${this._ui.planMenu ? "true" : "false"}" title="Switch category">
        <ha-icon icon="${current?.icon || "mdi:format-list-checks"}"></ha-icon><span class="label">${current?.label || "TaskDragon"}</span>${count !== null && count !== undefined ? html`<span class="count">${count}</span>` : ""}<ha-icon class="chev" icon="mdi:menu-down"></ha-icon></button>${menu}</span>`;
  }

  /**
   * Pop-up menus are position:fixed so no overflow:hidden ancestor (ha-card, a scroll area)
   * can clip them. Each sits under its trigger (the element just before it), flipping
   * sideways or above so it stays fully inside the viewport with a 12px margin.
   */
  _placeMenus(scope) {
    const margin = 12;
    for (const menu of (scope || this.shadowRoot).querySelectorAll(".menu")) {
      const anchor = menu.previousElementSibling;
      if (!anchor) continue;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      Object.assign(menu.style, {
        left: "0px",
        top: "0px",
        right: "auto",
        bottom: "auto",
        maxWidth: `${Math.max(180, viewportWidth - 2 * margin)}px`,
        maxHeight: `${Math.max(160, window.innerHeight - 2 * margin)}px`,
      });
      // A transformed/contained ancestor can become the containing block; measure its offset.
      const origin = menu.getBoundingClientRect();
      const box = anchor.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const vw = viewportWidth;
      const vh = window.innerHeight;
      let left = box.left;
      if (left + width > vw - margin) left = box.right - width;
      left = Math.min(Math.max(margin, left), Math.max(margin, vw - margin - width));
      let top = box.bottom + 4;
      if (top + height > vh - margin && box.top - 4 - height >= margin) top = box.top - 4 - height;
      top = Math.max(margin, Math.min(top, vh - margin - Math.min(height, vh - 2 * margin)));
      menu.style.left = `${Math.round(left - origin.left)}px`;
      menu.style.top = `${Math.round(top - origin.top)}px`;
    }
  }

  _menuHtml() {
    const tab = this._currentTab();
    const plan = this._idx.plans.get(tab);
    return html`<div class="menu">
      <button data-action="bulk-mode"><ha-icon icon="mdi:checkbox-multiple-marked-outline"></ha-icon>${this._ui.bulk ? "Exit bulk edit" : "Bulk edit"}</button>
      ${plan ? html`<button data-action="plan-edit" data-id="${plan.id}"><ha-icon icon="mdi:cog-outline"></ha-icon>Category settings</button>` : ""}
      ${plan?.archetype === "wishlist_hoard" ? html`<button data-action="h-settings"><ha-icon icon="mdi:tune-variant"></ha-icon>Price tracker settings</button>` : ""}
      <button data-action="plan-new"><ha-icon icon="mdi:playlist-plus"></ha-icon>New category / plan</button>
      <button data-action="categories"><ha-icon icon="mdi:eye-settings-outline"></ha-icon>Manage categories / hidden</button>
      ${this._board.mealie?.enabled ? html`<button data-action="mealie-sync"><ha-icon icon="mdi:sync"></ha-icon>Sync Mealie now</button>` : ""}
      <button data-action="refresh"><ha-icon icon="mdi:refresh"></ha-icon>Refresh</button>
      <button data-action="b-open-settings"><ha-icon icon="mdi:cog-outline"></ha-icon>Settings &amp; backups</button>
    </div>`;
  }

  _avatar(person, size = "sm") {
    if (!person) return html``;
    const picture = safeImageUrl(person.picture);
    const style = picture ? `background-image:url('${picture}');` : `background:${hashColor(person.entity_id)};`;
    return html`<span class="avatar ${size}" style="${style}" title="${person.name}">${picture ? "" : initials(person.name)}</span>`;
  }

  /* ---------------- Body ---------------- */

  _renderBody() {
    const body = this.shadowRoot.querySelector(".td-body");
    const focus = this._captureFocus();
    const tab = this._currentTab();
    let content;
    if (tab === "quick") content = this._quickWorkspaceHtml();
    else if (tab === "myday") content = this._myDayHtml();
    else if (tab === "family") content = this._familyHtml();
    else {
      const plan = this._idx.plans.get(tab);
      content = plan ? this._planHtml(plan) : html`<div class="empty">Category not found.</div>`;
    }
    setHTML(body, content);
    this._hydrateMarkdown(body);
    this._hydrateRecipeImages(body);
    this._hHydrate(body);
    this._placeMenus(body);
    this._restoreFocus(focus);
  }

  _captureFocus() {
    const active = this.shadowRoot.activeElement;
    if (!active || !active.dataset?.focus) return null;
    return { key: active.dataset.focus, value: active.value, start: active.selectionStart, end: active.selectionEnd };
  }

  _restoreFocus(state) {
    if (!state) return;
    const el = this.shadowRoot.querySelector(`[data-focus="${CSS.escape(state.key)}"]`);
    if (!el) return;
    el.value = state.value;
    el.focus();
    try {
      el.setSelectionRange(state.start, state.end);
    } catch (_err) {
      /* not a text input */
    }
  }

  _hydrateMarkdown(container) {
    const native = customElements.get("ha-markdown");
    for (const el of container.querySelectorAll("[data-markdown]")) {
      const text = el.dataset.markdown;
      if (native) {
        // ha-markdown renders and sanitizes Markdown itself.
        const md = document.createElement("ha-markdown");
        md.content = text;
        md.breaks = true;
        el.replaceChildren(md);
      } else {
        setHTML(el, simpleMarkdown(text));
      }
    }
  }

  _myDayHtml() {
    const me = this._ui.people.size === 1 ? [...this._ui.people][0] : this._me();
    if (!me) {
      return html`<div class="empty">Your Home Assistant user isn't linked to a person. Pick someone above, or use the Family view.</div>`;
    }
    const today = this._today();
    const all = this._board.tasks.filter((t) => !t.parent_uid && this._isActionable(t) && this._visible(t));
    const mine = all.filter((t) => t.assigned_to.includes(me));
    const pool = all.filter((t) => this._isPool(t) && this._isTodayRelevant(t) && t.status !== "completed");
    const relevant = this._ui.allMine ? mine : mine.filter((t) => this._isTodayRelevant(t));
    const open = relevant.filter((t) => t.status !== "completed");
    const done = relevant.filter((t) => t.status === "completed");
    const overdue = open.filter((t) => t.due_date && t.due_date < today);
    const rest = open.filter((t) => !(t.due_date && t.due_date < today));
    const person = this._person(me);
    const parts = [
      html`<div class="section-head">${this._avatar(person)} ${person.name}'s day
        <span class="grow"></span><button class="link" data-action="myday-all">${this._ui.allMine ? "Today only" : "All my tasks"}</button>
        <button class="link" data-action="add-task">+ Task</button></div>`,
    ];
    if (overdue.length) parts.push(this._section("Overdue", "mdi:alert-circle-outline", overdue, { showPlan: true }));
    const maint = this._maintAttention(me);
    if (maint.length) parts.push(this._maintAttentionHtml(maint));
    for (const [bucket, label, icon] of BUCKETS) {
      const list = rest.filter((t) => (t.time_of_day_bucket || "anytime") === bucket);
      if (list.length) parts.push(this._section(label, icon, list, { showPlan: true, drop: { kind: "bucket", value: bucket } }));
    }
    if (pool.length) parts.push(this._section("Up for grabs", "mdi:hand-back-left-outline", pool, { showPlan: true, claim: true }));
    if (!open.length && !pool.length && !maint.length) parts.push(html`<div class="empty">All clear for today. 🎉</div>`);
    if (done.length) parts.push(this._doneSection("myday", done));
    return html`${parts}`;
  }

  _familyHtml() {
    const people = (this._board.people || []).filter((p) => !this._ui.people.size || this._ui.people.has(p.entity_id));
    const tasks = this._board.tasks.filter((t) => !t.parent_uid && this._isActionable(t) && this._visible(t) && this._isTodayRelevant(t));
    const column = (title, sub, avatarHtml, list, dropValue) => {
      const open = this._sortTasks(list.filter((t) => t.status !== "completed"));
      const done = list.filter((t) => t.status === "completed");
      const pct = list.length ? Math.round((done.length / list.length) * 100) : 0;
      return html`<div class="col">
        <div class="col-head">${avatarHtml}<div>${title}<div class="sub">${sub} · ${done.length}/${list.length} done</div>
          <span class="progress"><span style="width:${pct}%"></span></span></div></div>
        <div class="drop" data-drop="person" data-value="${dropValue}">
          ${open.length ? open.map((t) => this._taskRow(t, { showPlan: true, claim: dropValue === "pool", kiosk: true })) : html`<div class="empty">Nothing left 🎉</div>`}
          ${done.map((t) => this._taskRow(t, { showPlan: true, kiosk: true }))}
        </div></div>`;
    };
    const columns = people.map((person) => {
      const list = tasks.filter((t) => t.assigned_to.length === 1 && t.assigned_to[0] === person.entity_id);
      const state = this._hass?.states[person.entity_id]?.state;
      return column(person.name, state === "home" ? "Home" : state === "not_home" ? "Away" : state || "", this._avatar(person, "lg"), list, person.entity_id);
    });
    const shared = tasks.filter((t) => t.assigned_to.length !== 1 || !(this._board.people || []).some((p) => p.entity_id === t.assigned_to[0]));
    columns.push(
      column("Household pool", "Up for grabs & shared", html`<span class="avatar lg" style="background:var(--td-accent)"><ha-icon icon="mdi:home-heart"></ha-icon></span>`, shared, "pool"),
    );
    return html`<div class="section-head">Today · ${new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
      <span class="grow"></span><button class="link" data-action="add-task">+ Task</button></div><div class="split">${columns}</div>`;
  }

  _section(label, icon, tasks, opts = {}) {
    return html`<div class="section">
      <div class="section-head"><ha-icon icon="${icon}"></ha-icon>${label} <span class="badge">${tasks.length}</span>
        <span class="grow"></span>${opts.headExtra || ""}</div>
      <div class="drop" ${opts.drop ? html`data-drop="${opts.drop.kind}" data-value="${opts.drop.value}"` : ""}>${this._sortTasks(tasks).map((t) => this._taskRow(t, opts))}</div>
    </div>`;
  }

  _doneSection(key, tasks) {
    const open = this._ui.showDone.has(key);
    return html`<div class="section">
      <div class="section-head"><ha-icon icon="mdi:check-all"></ha-icon>Done <span class="badge">${tasks.length}</span>
        <span class="grow"></span><button class="link" data-action="toggle-done" data-id="${key}">${open ? "Hide" : "Show"}</button></div>
      ${open ? tasks.map((t) => this._taskRow(t, { showPlan: key === "myday" })) : ""}
    </div>`;
  }

  /* ---------------- Task row ---------------- */

  _taskRow(task, opts = {}) {
    const plan = this._planOf(task);
    const done = task.status === "completed";
    const blocked = task.status === "blocked";
    const expanded = this._ui.expanded.has(task.uid);
    const progress = this._subProgress(task);
    const assignees = (task.assigned_to || []).map((p) => this._avatar(this._person(p)));
    const canClaim = opts.claim && this._isPool(task) && this._me() && !done;
    const description = expanded && task.description ? html`<div class="details" data-markdown="${task.description}"></div>` : "";
    const promote = opts.promote || plan.archetype === "quick_list";
    return html`<div class="task-row ${done ? "done" : ""} ${blocked ? "blocked" : ""}" data-uid="${task.uid}">
      ${this._ui.bulk ? html`<input type="checkbox" class="sel" data-action="bulk-select" data-id="${task.uid}" ${this._ui.selected.has(task.uid) ? html`checked` : ""} aria-label="Select">` : ""}
      ${opts.noDrag ? "" : html`<button class="handle" data-drag="${task.uid}" title="Drag to move" aria-label="Drag"><ha-icon icon="mdi:drag-vertical"></ha-icon></button>`}
      <button class="check ${done ? "on" : ""} prio-${task.priority}" data-action="toggle" data-id="${task.uid}" ${blocked ? html`disabled` : ""}
        aria-label="${done ? "Mark not done" : "Mark done"}">${done ? html`<ha-icon icon="mdi:check" style="--mdc-icon-size:16px"></ha-icon>` : ""}</button>
      <div class="task-main" data-action="expand" data-id="${task.uid}">
        <div class="summary">${task.summary}${task.quantity ? html` <span class="badge">${task.quantity}</span>` : ""}</div>
        <div class="meta">${this._badges(task, plan, opts)}
          ${progress ? html`<span class="badge"><ha-icon icon="mdi:checkbox-marked-outline"></ha-icon>${progress.done}/${progress.total}</span><span class="progress"><span style="width:${Math.round((progress.done / progress.total) * 100)}%"></span></span>` : ""}
        </div>
        ${this._lastDoneHtml(task)}
        ${description}${expanded ? this._subtasksHtml(task) : ""}
        ${canClaim ? html`<button class="claim" data-action="claim" data-id="${task.uid}">Claim</button>` : ""}
      </div>
      <div class="assignees">${assignees}</div>
      <div class="row-actions">
        ${promote && !done ? html`<button class="icon-btn" data-action="promote" data-id="${task.uid}" title="Move / promote to a plan" aria-label="Move or promote"><ha-icon icon="mdi:arrow-right-bold-circle-outline"></ha-icon></button>` : ""}
        ${task.status === "snoozed"
          ? html`<button class="icon-btn" data-action="unsnooze" data-id="${task.uid}" title="Wake up" aria-label="Wake up"><ha-icon icon="mdi:alarm-off"></ha-icon></button>`
          : done
            ? task.recurrence_mode === "none" && !task.parent_uid ? html`<button class="icon-btn" data-action="clear-one" data-id="${task.uid}" title="Clear it off the list" aria-label="Clear it off the list"><ha-icon icon="mdi:close-circle-outline"></ha-icon></button>` : ""
            : html`<button class="icon-btn" data-action="snooze" data-id="${task.uid}" title="Snooze" aria-label="Snooze"><ha-icon icon="mdi:sleep"></ha-icon></button>`}
        <button class="icon-btn" data-action="open" data-id="${task.uid}" title="Edit" aria-label="Edit"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
      </div>
    </div>`;
  }

  _badges(task, plan, opts) {
    const out = [];
    const today = this._today();
    if (opts.showPlan && plan.name) out.push(html`<span class="badge plan">${plan.is_private ? html`<ha-icon icon="mdi:lock-outline"></ha-icon>` : ""}${plan.name}</span>`);
    if (task.priority === "urgent" || task.priority === "high") {
      out.push(html`<span class="badge ${task.priority}"><ha-icon icon="mdi:flag"></ha-icon>${task.priority}</span>`);
    }
    if (task.status === "in_process") out.push(html`<span class="badge today"><ha-icon icon="mdi:progress-clock"></ha-icon>In progress</span>`);
    if (task.expires_at) {
      const ms = new Date(task.expires_at) - new Date();
      const days = Math.ceil(ms / 86400000);
      const label = ms <= 0 ? "Expired" : days <= 1 ? (ms < 86400000 && new Date(task.expires_at).getDate() === new Date().getDate() ? "Expires today" : "1 day left") : `${days} days left`;
      out.push(html`<span class="badge ${ms <= 0 || days <= 1 ? "expired" : "today"}"><ha-icon icon="mdi:timer-sand"></ha-icon>${label}</span>`);
    } else if (task.due_date && task.status !== "completed") {
      const diff = dayDiff(today, task.due_date);
      let label;
      let cls = "";
      if (diff < 0) {
        label = `Overdue ${-diff}d`;
        cls = "overdue";
      } else if (diff === 0) {
        label = "Today";
        cls = "today";
      } else if (diff === 1) label = "Tomorrow";
      else if (diff < 7) label = weekdayShort(task.due_date);
      else label = monthDay(task.due_date);
      if (task.due_datetime) label += ` ${fmtTime(new Date(task.due_datetime))}`;
      out.push(html`<span class="badge ${cls}"><ha-icon icon="mdi:calendar"></ha-icon>${label}</span>`);
    } else if (task.due_date && task.recurrence_mode !== "none" && dayDiff(today, task.due_date) >= 1) {
      const diff = dayDiff(today, task.due_date);
      out.push(html`<span class="badge ok"><ha-icon icon="mdi:calendar-refresh"></ha-icon>Next ${diff === 1 ? "tomorrow" : diff < 7 ? weekdayShort(task.due_date) : monthDay(task.due_date)}</span>`);
    }
    if (task.recurrence_label) out.push(html`<span class="badge"><ha-icon icon="mdi:repeat"></ha-icon>${task.recurrence_label}</span>`);
    if (task.remind_target && task.status !== "completed") {
      const where = this._reminderLabel(task.remind_target);
      out.push(html`<span class="badge" title="Reminder: ${where}"><ha-icon icon="mdi:bell-ring-outline"></ha-icon>${this._reminderClock(task)}</span>`);
    }
    if (task.streak > 1) out.push(html`<span class="badge streak">🔥 ${task.streak}</span>`);
    if (task.status === "blocked") {
      const names = (task.open_blockers || []).map((b) => b.summary).join(", ");
      out.push(html`<span class="badge overdue"><ha-icon icon="mdi:lock-outline"></ha-icon>${names ? `Blocked by ${names}` : "Blocked"}</span>`);
    }
    if (task.status === "snoozed") {
      out.push(html`<span class="badge"><ha-icon icon="mdi:sleep"></ha-icon>${task.snooze_rule?.label || (task.snoozed_until ? `Until ${new Date(task.snoozed_until).toLocaleString()}` : "Snoozed")}</span>`);
    }
    if (task.shift_aware) out.push(html`<span class="badge" title="Assigned daily by work shifts"><ha-icon icon="mdi:account-switch"></ha-icon>Shift-aware</span>`);
    if (task.sensor_entity_id) out.push(this._sensorBadge(task));
    const link = safeUrl(task.link_url);
    const slug = this._board.mealie?.enabled ? taskRecipeSlug(task) : null;
    if (slug) out.push(html`<button class="badge" data-action="c-open" data-slug="${slug}" data-name="${task.summary}" data-stop title="Open the cooking view"><ha-icon icon="mdi:chef-hat"></ha-icon>Cook view</button>`);
    if (link) out.push(html`<a class="badge" href="${link}" target="_blank" rel="noopener noreferrer" data-stop><ha-icon icon="mdi:open-in-new"></ha-icon>Recipe</a>`);
    return html`${out}`;
  }

  /** Where a reminder goes, in words. */
  _reminderLabel(target) {
    if (target === "assigned") return "the assigned person's phone";
    const known = (this._board.notify_targets || []).find((t) => t.id === target);
    return known ? known.name : target.replace(/^notify\./, "").replace(/^mobile_app_/, "").replace(/_/g, " ");
  }

  /** The time a reminder goes out, as the server works it out (see reminders.py). */
  _reminderClock(task) {
    if (task.remind_time) return task.remind_time;
    if (task.due_datetime && localISODate(new Date(task.due_datetime)) === task.due_date) return fmtTime(new Date(task.due_datetime));
    return { morning: "08:00", afternoon: "13:00", evening: "18:00" }[task.time_of_day_bucket] || "09:00";
  }

  _sensorBadge(task) {
    const state = this._hass?.states[task.sensor_entity_id];
    const name = state?.attributes?.friendly_name || task.sensor_entity_id;
    if ((task.sensor_mode || "delta") === "binary") {
      return html`<span class="badge"><ha-icon icon="mdi:motion-sensor"></ha-icon>${name}: ${state?.state ?? "?"}</span>`;
    }
    const value = Number(state?.state);
    const baseline = Number(task.sensor_baseline);
    const threshold = Number(task.sensor_threshold);
    if (!Number.isFinite(value) || !Number.isFinite(baseline) || !threshold) {
      return html`<span class="badge"><ha-icon icon="mdi:gauge"></ha-icon>${name}</span>`;
    }
    const used = Math.max(0, value - baseline);
    const pct = Math.min(100, Math.round((used / threshold) * 100));
    const unit = state?.attributes?.unit_of_measurement || "";
    return html`<span class="badge ${pct >= 100 ? "overdue" : pct >= 80 ? "today" : ""}"><ha-icon icon="mdi:gauge"></ha-icon>${Math.round(used * 10) / 10}/${threshold} ${unit}</span>
      <span class="progress"><span style="width:${pct}%;${pct >= 100 ? "background:var(--td-danger)" : ""}"></span></span>`;
  }

  _lastDoneHtml(task) {
    const last = task.last_done;
    if (!last || task.recurrence_mode === "none") return html``;
    const when = new Date(last.completed_at);
    const diff = dayDiff(localISODate(when), localISODate(new Date()));
    const day = diff === 0 ? "today" : diff === 1 ? "yesterday" : diff < 7 ? when.toLocaleDateString([], { weekday: "long" }) : when.toLocaleDateString([], { month: "short", day: "numeric" });
    const who = last.person_entity_id ? this._person(last.person_entity_id).name : last.user_name || "someone";
    return html`<div class="lastdone">Last done by ${who} ${day} at ${fmtTime(when)}</div>`;
  }

  _subtasksHtml(task, scope = "row") {
    const kids = this._idx.children.get(task.uid) || [];
    return html`<div class="subtasks" data-stop>
      ${kids.map(
        (k) => html`<div class="subtask ${k.status === "completed" ? "done" : ""}">
          <button class="check ${k.status === "completed" ? "on" : ""}" data-action="toggle" data-id="${k.uid}" aria-label="Toggle">${k.status === "completed" ? html`<ha-icon icon="mdi:check" style="--mdc-icon-size:12px"></ha-icon>` : ""}</button>
          <span>${k.summary}</span>
          <button class="icon-btn" style="width:28px;height:28px" data-action="delete-sub" data-id="${k.uid}" title="Remove" aria-label="Remove"><ha-icon icon="mdi:close" style="--mdc-icon-size:16px"></ha-icon></button>
        </div>`,
      )}
      <div class="subtask"><input data-focus="${scope}-sub-${task.uid}" data-subtask-for="${task.uid}" maxlength="500" placeholder="Add a checklist item…" enterkeyhint="done"></div>
    </div>`;
  }

  /* ---------------- Quick lists ---------------- */

  _quickWorkspaceHtml() {
    const quick = this._board.quick || {};
    const planId = this._quickPlanId();
    const plan = this._idx.plans.get(planId);
    if (!plan) return html`<div class="empty">No quick list is available.</div>`;
    const scope = planId === quick.private ? "private" : "shared";
    const names = (plan.shared_with || [])
      .map((userId) => (this._board.people || []).find((p) => p.user_id === userId)?.name)
      .filter(Boolean);
    const note =
      scope === "private"
        ? names.length
          ? `Private · shared with ${names.join(", ")}`
          : "Private · only you can see this list"
        : "Everyone in the household sees this list";
    return html`<div class="scope-bar">
        <div class="seg" role="tablist" aria-label="Which quick list">
          <button class="${scope === "shared" ? "on" : ""}" role="tab" aria-selected="${scope === "shared"}" data-action="quick-scope" data-id="shared" ${quick.shared ? "" : html`disabled`}><ha-icon icon="mdi:home-heart"></ha-icon>Shared household</button>
          <button class="${scope === "private" ? "on" : ""}" role="tab" aria-selected="${scope === "private"}" data-action="quick-scope" data-id="private" ${quick.private ? "" : html`disabled`}><ha-icon icon="mdi:lock-outline"></ha-icon>My private</button>
        </div>
        <span class="note"><ha-icon icon="${scope === "private" ? "mdi:eye-off-outline" : "mdi:account-group-outline"}"></ha-icon>${note}</span>
        ${scope === "private" && plan.is_owner ? html`<button class="link" data-action="plan-edit" data-id="${plan.id}">Share…</button>` : ""}
      </div>
      ${this._quickListHtml(plan)}`;
  }

  _quickListHtml(plan) {
    const all = (this._idx.byPlan.get(plan.id) || []).filter((t) => this._matchesSearch(t));
    const tasks = all.filter((t) => t.status !== "snoozed" && !(t.status === "blocked" && t.hide_when_blocked));
    const snoozed = all.filter((t) => t.status === "snoozed");
    const sections = this._idx.sections.get(plan.id) || [];
    const known = new Set(sections.map((s) => s.id));
    const sectionOf = (t) => (t.section_id && known.has(t.section_id) ? t.section_id : "");
    const done = tasks.filter((t) => t.status === "completed");
    const target = this._ui.quickTarget?.[plan.id] || "";
    const parts = [
      html`<div class="quick-add">
        <input data-focus="qadd-${plan.id}" data-quick-input="${plan.id}" maxlength="500" placeholder="Add to ${plan.name}… (try “Calls: dentist”)" enterkeyhint="done" aria-label="Quick add">
        <select data-quick-section="${plan.id}" aria-label="Section">
          <option value="">Inbox</option>
          ${sections.map((s) => html`<option value="${s.id}" ${target === s.id ? html`selected` : ""}>${s.name}</option>`)}
        </select>
        <button class="btn" data-action="quick-add" data-plan="${plan.id}"><ha-icon icon="mdi:plus"></ha-icon>Add</button>
      </div>`,
      this._quickSectionHtml(plan, null, tasks.filter((t) => sectionOf(t) === ""), 0, sections.length),
      ...sections.map((s, index) => this._quickSectionHtml(plan, s, tasks.filter((t) => sectionOf(t) === s.id), index, sections.length)),
      html`<div class="inline-add compact">
        <input data-focus="newsec-${plan.id}" data-new-section="${plan.id}" maxlength="120" placeholder="New section… e.g. Calls to Make" enterkeyhint="done" aria-label="New section name">
        <button class="btn flat" data-action="section-add" data-plan="${plan.id}"><ha-icon icon="mdi:folder-plus-outline"></ha-icon>Add section</button>
      </div>`,
    ];
    if (done.length) {
      parts.push(html`<div class="section-head"><span class="grow"></span><button class="link" data-action="clear-completed" data-plan="${plan.id}">Clear ${done.length} completed</button></div>`);
    }
    if (snoozed.length) parts.push(this._collapsible(`snoozed-${plan.id}`, "Snoozed", "mdi:sleep", snoozed));
    return html`${parts}`;
  }

  _quickSectionHtml(plan, section, tasks, index, total) {
    const key = section ? `sec:${section.id}` : `inbox:${plan.id}`;
    const closed = this._isCollapsed(key);
    const open = tasks.filter((t) => t.status !== "completed");
    const done = tasks.filter((t) => t.status === "completed");
    const name = section ? section.name : "Inbox";
    const renaming = section && this._ui.renaming === section.id;
    const head = renaming
      ? html`<input class="rename-input" data-focus="ren-${section.id}" data-rename-section="${section.id}" value="${section.name}" maxlength="120" aria-label="Section name" autofocus>
          <button class="icon-btn sm" data-action="section-rename-save" data-id="${section.id}" title="Save" aria-label="Save name"><ha-icon icon="mdi:check"></ha-icon></button>
          <button class="icon-btn sm" data-action="section-rename-cancel" title="Cancel" aria-label="Cancel rename"><ha-icon icon="mdi:close"></ha-icon></button>`
      : html`<button class="collapse-btn ${closed ? "closed" : ""}" data-action="collapse" data-id="${key}" aria-expanded="${!closed}">
          <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>
          ${section ? "" : html`<ha-icon icon="mdi:inbox-outline"></ha-icon>`}
          <span class="title">${name}</span>
          <span class="badge">${open.length}${done.length ? ` · ${done.length} done` : ""}</span>
        </button>
        ${section
          ? html`<span class="qs-actions">
              <button class="icon-btn sm" data-action="section-rename" data-id="${section.id}" title="Rename" aria-label="Rename section"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
              <button class="icon-btn sm" data-action="section-move" data-id="${section.id}" data-dir="-1" ${index === 0 ? html`disabled` : ""} title="Move up" aria-label="Move section up"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
              <button class="icon-btn sm" data-action="section-move" data-id="${section.id}" data-dir="1" ${index === total - 1 ? html`disabled` : ""} title="Move down" aria-label="Move section down"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
              <button class="icon-btn sm" data-action="section-delete" data-id="${section.id}" title="Delete section (tasks move to the inbox)" aria-label="Delete section"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
            </span>`
          : ""}`;
    return html`<div class="qsection drop" data-drop="section" data-value="${section ? section.id : ""}">
      <div class="qs-head ${section ? "" : "inbox"}">${head}</div>
      ${closed
        ? ""
        : html`<div class="qs-body">
            ${open.map((t) => this._taskRow(t, { promote: true }))}
            ${done.map((t) => this._taskRow(t))}
            ${tasks.length ? "" : html`<div class="empty sm">${section ? "Nothing here yet." : "New items land here."}</div>`}
            <div class="inline-add compact"><input data-focus="sadd-${key}" data-section-input="${section ? section.id : ""}" data-plan="${plan.id}" maxlength="500" placeholder="+ Add task" enterkeyhint="done" aria-label="Add task to ${name}"></div>
          </div>`}
    </div>`;
  }

  /* ---------------- Plan views ---------------- */

  _planHtml(plan) {
    const tasks = (this._idx.byPlan.get(plan.id) || []).filter((t) => {
      if (!this._matchesSearch(t)) return false;
      if (this._ui.people.size && ACTIONABLE.has(plan.archetype) && plan.archetype !== "quick_list") {
        return t.assigned_to.some((p) => this._ui.people.has(p)) || this._isPool(t);
      }
      return true;
    });
    switch (plan.archetype) {
      case "quick_list":
        return html`${plan.is_private ? html`<div class="scope-bar"><span class="note"><ha-icon icon="mdi:lock-outline"></ha-icon>Private category${plan.is_owner ? "" : " shared with you"}</span></div>` : ""}${this._quickListHtml(plan)}`;
      case "daily_chores":
        return this._agendaHtml(plan, tasks);
      case "shopping_errands":
        return this._shoppingHtml(plan, tasks);
      case "projects_diy":
        return this._projectHtml(plan, tasks);
      case "home_maintenance":
        return this._maintHtml(plan);
      case "packing_trips":
        return this._packingHtml(plan, tasks);
      case "pantry_spices":
        return this._pantryHtml(plan);
      case "wishlist_hoard":
        return this._hoardHtml(plan);
      default:
        return this._section(plan.name, "mdi:format-list-checks", tasks.filter((t) => this._visible(t)));
    }
  }

  _agendaHtml(plan, tasks) {
    const today = this._today();
    const visible = tasks.filter((t) => this._visible(t));
    const current = visible.filter((t) => (t.status === "completed" ? this._isTodayRelevant(t) || t.recurrence_mode !== "none" : !t.due_date || t.due_date <= today));
    const upcoming = visible.filter((t) => t.status !== "completed" && t.due_date && t.due_date > today);
    const snoozed = tasks.filter((t) => t.status === "snoozed");
    const parts = [html`<div class="section-head">${plan.name}<span class="grow"></span><button class="link" data-action="add-task" data-plan="${plan.id}">+ Chore</button></div>`];
    for (const [bucket, label, icon] of BUCKETS) {
      const list = current.filter((t) => !this._isPool(t) && (t.time_of_day_bucket || "anytime") === bucket);
      parts.push(
        this._section(label, icon, list, {
          drop: { kind: "bucket", value: bucket },
          headExtra: html`<button class="link" data-action="add-task" data-plan="${plan.id}" data-bucket="${bucket}">+</button>`,
        }),
      );
    }
    const pool = current.filter((t) => this._isPool(t));
    parts.push(this._section("Up for grabs", "mdi:hand-back-left-outline", pool, { claim: true, drop: { kind: "person", value: "pool" } }));
    if (upcoming.length) parts.push(this._collapsible(`upcoming-${plan.id}`, "Upcoming", "mdi:calendar-arrow-right", upcoming));
    if (snoozed.length) parts.push(this._collapsible(`snoozed-${plan.id}`, "Snoozed", "mdi:sleep", snoozed));
    return html`${parts}`;
  }

  _collapsible(key, label, icon, tasks) {
    const open = this._ui.showDone.has(key);
    return html`<div class="section"><div class="section-head"><ha-icon icon="${icon}"></ha-icon>${label} <span class="badge">${tasks.length}</span>
      <span class="grow"></span><button class="link" data-action="toggle-done" data-id="${key}">${open ? "Hide" : "Show"}</button></div>
      ${open ? this._sortTasks(tasks).map((t) => this._taskRow(t)) : ""}</div>`;
  }

  _shoppingHtml(plan, tasks) {
    const mode = this._isGroceryPlan(plan) ? this._ui.shop[plan.id] || "list" : "list";
    if (mode === "recipes") return html`${this._shopTabsHtml(plan, mode)}${this._recipesHtml(plan)}`;
    if (mode === "pantry") return html`${this._shopTabsHtml(plan, mode)}${this._pantryDrawerHtml(plan)}`;
    const open = tasks.filter((t) => t.status !== "completed");
    const done = tasks.filter((t) => t.status === "completed");
    const categories = [...AISLES, ...new Set(open.map((t) => t.category).filter((c) => c && !AISLES.includes(c)))];
    const history = this._history[plan.id];
    const parts = [
      this._shopTabsHtml(plan, mode),
      html`<div class="shop-add">
        <input data-focus="shop-${plan.id}" data-shop-input="${plan.id}" maxlength="500" placeholder="Add item… e.g. 2 lbs ground beef" enterkeyhint="done" list="td-hist-${plan.id}">
        <datalist id="td-hist-${plan.id}">${(history || []).map((h) => html`<option value="${h.display_name}">`)}</datalist>
        <button class="btn" data-action="shop-add" data-plan="${plan.id}" aria-label="Add item"><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>
      <div class="section-head"><ha-icon icon="mdi:history"></ha-icon>Frequently bought<span class="grow"></span>
        <button class="link" data-action="history-toggle" data-plan="${plan.id}">${this._ui.showHistory ? "Hide" : "Show"}</button></div>`,
    ];
    if (this._ui.showHistory) {
      parts.push(html`<div class="history">${
        history === undefined
          ? html`<span class="empty">Loading…</span>`
          : history.length
            ? history.map((h) => html`<button class="chip" data-action="history-add" data-plan="${plan.id}" data-name="${h.display_name}">+ ${h.display_name} <small>×${h.times_added}</small></button>`)
            : html`<span class="empty">Items you add show up here for one-tap re-adding.</span>`
      }</div>`);
    }
    if (!open.length) parts.push(html`<div class="empty">The list is empty.</div>`);
    for (const category of categories) {
      const items = open.filter((t) => (t.category || "Other") === category);
      if (!items.length) continue;
      parts.push(html`<div class="section"><div class="section-head">${category} <span class="badge">${items.length}</span></div>
        <div class="aisle-grid drop" data-drop="category" data-value="${category}">${items.map((t) => this._tileHtml(t))}</div></div>`);
    }
    if (done.length) {
      const showDone = this._ui.showDone.has(`cart-${plan.id}`);
      parts.push(html`<div class="section"><div class="section-head"><ha-icon icon="mdi:cart-check"></ha-icon>In the cart <span class="badge">${done.length}</span><span class="grow"></span>
        <button class="link" data-action="toggle-done" data-id="cart-${plan.id}">${showDone ? "Hide" : "Show"}</button>
        <button class="link" data-action="clear-completed" data-plan="${plan.id}">Clear</button></div>
        ${showDone ? html`<div class="aisle-grid">${done.map((t) => this._tileHtml(t))}</div>` : ""}</div>`);
    }
    return html`${parts}`;
  }

  _tileHtml(task) {
    return html`<button class="tile ${task.status === "completed" ? "done" : ""} task-row" data-uid="${task.uid}" data-action="toggle" data-id="${task.uid}" data-drag-tile="${task.uid}">
      <span class="name">${task.summary}</span>
      ${task.quantity ? html`<span class="qty">${task.quantity}</span>` : ""}
      ${(task.assigned_to || []).length ? html`<span class="qty">${task.assigned_to.map((p) => this._person(p).name).join(", ")}</span>` : ""}
      <span class="icon-btn edit" data-action="open" data-id="${task.uid}" role="button" aria-label="Edit"><ha-icon icon="mdi:dots-horizontal"></ha-icon></span>
    </button>`;
  }

  _projectHtml(plan, tasks) {
    const visible = tasks.filter((t) => this._visible(t));
    const parts = [
      this._bomHtml(plan),
      html`<div class="section-head">${plan.name}<span class="grow"></span>
        <span class="toggle-group">
          <button class="chip ${this._ui.kanbanMode === "kanban" ? "on" : ""}" data-action="kanban-mode" data-id="kanban">Kanban</button>
          <button class="chip ${this._ui.kanbanMode === "deps" ? "on" : ""}" data-action="kanban-mode" data-id="deps">Dependencies</button>
        </span>
        <button class="link" data-action="add-task" data-plan="${plan.id}">+ Task</button></div>`,
    ];
    if (this._ui.kanbanMode === "kanban") {
      const columnOf = (t) => (t.status === "completed" ? "done" : t.status === "in_process" ? "in_progress" : t.status === "blocked" ? "backlog" : t.kanban_column || "backlog");
      parts.push(html`<div class="kanban">${KANBAN.map(([key, label]) => {
        const list = visible.filter((t) => columnOf(t) === key);
        return html`<div class="col"><div class="col-head">${label} <span class="badge">${list.length}</span></div>
          <div class="drop" data-drop="kanban" data-value="${key}">${list.length ? this._sortTasks(list).map((t) => this._taskRow(t)) : html`<div class="empty" style="padding:12px">Drop here</div>`}</div></div>`;
      })}</div>`);
    } else {
      parts.push(this._dependencyListHtml(visible));
    }
    return html`${parts}`;
  }

  _dependencyListHtml(tasks) {
    const byUid = new Map(tasks.map((t) => [t.uid, t]));
    const depth = new Map();
    const depthOf = (t, trail = new Set()) => {
      if (depth.has(t.uid)) return depth.get(t.uid);
      const parents = (t.blocked_by || []).filter((b) => byUid.has(b) && !trail.has(b));
      const value = parents.length ? 1 + Math.max(...parents.map((b) => depthOf(byUid.get(b), new Set([...trail, t.uid])))) : 0;
      depth.set(t.uid, value);
      return value;
    };
    tasks.forEach((t) => depthOf(t));
    const ordered = [...tasks].sort((a, b) => depth.get(a.uid) - depth.get(b.uid) || a.position - b.position);
    if (!ordered.length) return html`<div class="empty">No tasks yet.</div>`;
    return html`<div class="drop" data-drop="list" data-value="">${ordered.map(
      (t) => html`<div style="margin-left:${Math.min(depth.get(t.uid), 6) * 22}px">${this._taskRow(t, { noDrag: true })}</div>`,
    )}</div>`;
  }

  _bomHtml(plan) {
    const items = (this._board.bom || []).filter((b) => b.plan_id === plan.id);
    const open = this._ui.showDone.has(`bom-${plan.id}`) || items.length === 0;
    const pending = items.filter((b) => !b.acquired).length;
    return html`<div class="bom">
      <div class="section-head"><ha-icon icon="mdi:clipboard-list-outline"></ha-icon>Bill of materials <span class="badge">${pending}/${items.length} needed</span><span class="grow"></span>
        ${items.length ? html`<button class="link" data-action="toggle-done" data-id="bom-${plan.id}">${open ? "Hide" : "Show"}</button>` : ""}
        ${pending ? html`<button class="btn small" data-action="bom-push" data-plan="${plan.id}"><ha-icon icon="mdi:cart-arrow-right"></ha-icon>Push to Hardware list</button>` : ""}</div>
      ${open
        ? html`<table>${items.map(
            (b) => html`<tr class="${b.acquired ? "acquired" : ""}">
              <td class="n"><input type="checkbox" data-action="bom-toggle" data-id="${b.id}" ${b.acquired ? html`checked` : ""} aria-label="Acquired"></td>
              <td>${b.name}</td><td class="n">${b.quantity || ""}</td>
              <td class="n">${b.pushed_task_uid && !b.acquired ? html`<span class="badge ok">on list</span>` : ""}</td>
              <td class="n"><button class="icon-btn" style="width:30px;height:30px" data-action="bom-delete" data-id="${b.id}" aria-label="Remove"><ha-icon icon="mdi:close"></ha-icon></button></td></tr>`,
          )}</table>
          <div class="inline-add">
            <input data-focus="bom-qty-${plan.id}" data-bom-qty="${plan.id}" maxlength="120" placeholder="Qty" style="flex:0 0 90px">
            <input data-focus="bom-${plan.id}" data-bom-input="${plan.id}" maxlength="120" placeholder="Add material… e.g. 2x4x8 stud">
            <button class="btn flat" data-action="bom-add" data-plan="${plan.id}" aria-label="Add material"><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>`
        : ""}
    </div>`;
  }

  /* ---------------- Trip packing ---------------- */

  _packingHtml(plan, tasks) {
    const trips = this._idx.trips.get(plan.id) || [];
    const upcoming = trips
      .filter((t) => t.status !== "archived")
      .sort((a, b) => String(a.start_date || "9999").localeCompare(String(b.start_date || "9999")) || a.position - b.position);
    const archived = trips.filter((t) => t.status === "archived").sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));
    const byTrip = new Map();
    for (const task of tasks) {
      const key = task.trip_id || "";
      if (!byTrip.has(key)) byTrip.set(key, []);
      byTrip.get(key).push(task);
    }
    const repeatable = plan.repeatable_count || 0;
    const parts = [
      html`<div class="section-head">${plan.name}
        <span class="badge" title="Items marked repeatable are copied into every new trip"><ha-icon icon="mdi:repeat"></ha-icon>${repeatable} always-pack</span>
        <span class="grow"></span>
        <button class="btn small" data-action="trip-new" data-plan="${plan.id}"><ha-icon icon="mdi:plus"></ha-icon>New trip</button></div>`,
    ];
    if (!upcoming.length) {
      parts.push(html`<div class="empty sm">No trips planned. “New trip” starts one with all ${repeatable} repeatable items already on it.</div>`);
    }
    for (const trip of upcoming) parts.push(this._tripCardHtml(plan, trip, byTrip.get(trip.id) || []));
    parts.push(this._masterCardHtml(plan, byTrip.get("") || []));
    if (archived.length) {
      const key = `archived-${plan.id}`;
      const open = this._ui.showDone.has(key);
      parts.push(html`<div class="section"><div class="section-head"><ha-icon icon="mdi:archive-outline"></ha-icon>Archived trips <span class="badge">${archived.length}</span>
        <span class="grow"></span><button class="link" data-action="toggle-done" data-id="${key}">${open ? "Hide" : "Show"}</button></div>
        ${open ? archived.map((trip) => this._tripCardHtml(plan, trip, byTrip.get(trip.id) || [])) : ""}</div>`);
    }
    return html`${parts}`;
  }

  _tripStatusText(trip) {
    if (trip.status === "upcoming" && trip.start_date) {
      const days = dayDiff(this._today(), trip.start_date);
      return days === 1 ? "Tomorrow" : days > 1 ? `In ${days} days` : "Upcoming";
    }
    return trip.status === "active" ? "Active" : trip.status === "archived" ? "Archived" : "Upcoming";
  }

  _tripCardHtml(plan, trip, items) {
    const key = `trip:${trip.id}`;
    const closed = this._isCollapsed(key);
    const packed = items.filter((t) => t.status === "completed").length;
    const pct = items.length ? Math.round((packed / items.length) * 100) : 0;
    const archived = trip.status === "archived";
    return html`<div class="trip-card drop" data-drop="trip" data-value="${trip.id}">
      <div class="trip-head">
        <button class="collapse-btn ${closed ? "closed" : ""}" data-action="collapse" data-id="${key}" aria-expanded="${!closed}">
          <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>
          <span class="trip-info">
            <span class="title">${trip.name}</span>
            <span class="sub"><span class="status-chip ${trip.status}">${this._tripStatusText(trip)}</span>${dateRange(trip.start_date, trip.end_date)}</span>
            <span class="progress wide" aria-hidden="true"><span style="width:${pct}%"></span></span>
          </span>
        </button>
        <span class="trip-progress" aria-label="${packed} of ${items.length} packed">${packed} / ${items.length} Packed</span>
        <span class="qs-actions">
          <button class="icon-btn sm" data-action="trip-edit" data-id="${trip.id}" title="Edit trip" aria-label="Edit trip"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
          <button class="icon-btn sm" data-action="trip-reset" data-id="${trip.id}" title="Uncheck everything" aria-label="Uncheck everything"><ha-icon icon="mdi:restore"></ha-icon></button>
          <button class="icon-btn sm" data-action="trip-archive" data-id="${trip.id}" data-archived="${archived ? "1" : ""}" title="${archived ? "Restore trip" : "Archive trip"}" aria-label="${archived ? "Restore trip" : "Archive trip"}"><ha-icon icon="${archived ? "mdi:archive-arrow-up-outline" : "mdi:archive-outline"}"></ha-icon></button>
          <button class="icon-btn sm" data-action="trip-delete" data-id="${trip.id}" title="Delete trip" aria-label="Delete trip"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
        </span>
      </div>
      ${closed
        ? ""
        : html`<div class="trip-body">
            ${items.length ? this._packGroupsHtml(trip.id, items) : html`<div class="empty sm">Nothing on this trip yet.</div>`}
            ${this._packAddHtml(plan, trip.id)}
          </div>`}
    </div>`;
  }

  _masterCardHtml(plan, items) {
    const key = `master:${plan.id}`;
    const closed = this._isCollapsed(key);
    return html`<div class="trip-card master drop" data-drop="trip" data-value="">
      <div class="trip-head">
        <button class="collapse-btn ${closed ? "closed" : ""}" data-action="collapse" data-id="${key}" aria-expanded="${!closed}">
          <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>
          <span class="trip-info">
            <span class="title"><ha-icon icon="mdi:star-box-outline" style="--mdc-icon-size:18px"></ha-icon> Always pack</span>
            <span class="sub">Master list. Repeatable items here and on any trip are copied into every new trip.</span>
          </span>
        </button>
        <span class="badge">${items.length}</span>
      </div>
      ${closed
        ? ""
        : html`<div class="trip-body">
            ${items.length ? this._packGroupsHtml("", items) : html`<div class="empty sm">Add the things you take every time.</div>`}
            ${this._packAddHtml(plan, "")}
          </div>`}
    </div>`;
  }

  _packAddHtml(plan, tripId) {
    return html`<div class="inline-add compact">
      <input data-focus="pack-${plan.id}-${tripId}" data-trip-input="${tripId}" data-plan="${plan.id}" maxlength="500" placeholder="Add item… (e.g. Tech: phone charger)" enterkeyhint="done" aria-label="Add packing item">
      <button class="btn flat" data-action="pack-add" data-trip="${tripId}" data-plan="${plan.id}" aria-label="Add item"><ha-icon icon="mdi:plus"></ha-icon></button>
    </div>`;
  }

  _packGroupsHtml(tripId, items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.category || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const rank = (name) => {
      const index = PACKING_GROUPS.indexOf(name);
      return name === "Other" ? 1000 : index === -1 ? 500 : index;
    };
    const names = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return html`${names.map((name) => {
      const list = groups.get(name).sort((a, b) => a.position - b.position);
      const key = `tg:${tripId || "master"}:${name}`;
      const closed = this._isCollapsed(key);
      const packed = list.filter((t) => t.status === "completed").length;
      return html`<div class="pack-group drop" data-drop="trip-group" data-trip="${tripId}" data-value="${name}">
        <div class="pack-group-head">
          <button class="collapse-btn ${closed ? "closed" : ""}" data-action="collapse" data-id="${key}" aria-expanded="${!closed}">
            <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="title">${name}</span><span class="badge">${packed}/${list.length}</span>
          </button>
          <button class="icon-btn sm" data-action="pack-group-add" data-trip="${tripId}" data-group="${name}" title="Add to ${name}" aria-label="Add to ${name}"><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
        ${closed ? "" : list.map((task) => this._packRowHtml(task))}
      </div>`;
    })}`;
  }

  _packRowHtml(task) {
    const done = task.status === "completed";
    const repeat = !!task.is_repeatable;
    return html`<div class="pack-row task-row ${done ? "done" : ""}" data-uid="${task.uid}">
      <button class="handle" data-drag="${task.uid}" title="Drag to move" aria-label="Drag"><ha-icon icon="mdi:drag-vertical"></ha-icon></button>
      <button class="pack-check ${done ? "on" : ""}" data-action="toggle" data-id="${task.uid}" aria-pressed="${done}" aria-label="${done ? "Mark not packed" : "Mark packed"}: ${task.summary}">
        ${done ? html`<ha-icon icon="mdi:check-bold"></ha-icon>` : ""}</button>
      <span class="pack-name" data-action="open" data-id="${task.uid}">${task.summary}${task.quantity ? html` <span class="badge">${task.quantity}</span>` : ""}</span>
      <button class="icon-btn repeat ${repeat ? "on" : ""}" data-action="repeat-toggle" data-id="${task.uid}" aria-pressed="${repeat}"
        title="${repeat ? "Repeatable: added to every new trip (tap for one-off)" : "One-off: only on this trip (tap to always pack)"}"
        aria-label="${repeat ? "Repeatable" : "One-off"}"><ha-icon icon="${repeat ? "mdi:repeat" : "mdi:repeat-off"}"></ha-icon></button>
    </div>`;
  }

  /* ---------------- Pantry ---------------- */

  _pantryHtml(plan) {
    const q = this._ui.search.trim().toLowerCase();
    const items = (this._board.pantry || []).filter((i) => i.plan_id === plan.id && (!q || i.name.toLowerCase().includes(q)));
    const groups = new Map();
    for (const item of items) {
      const key = item.category || (item.is_batch ? "Homemade blends" : "Staples");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const low = items.filter((i) => i.stock_state !== "in_stock").length;
    const actions = { shopping: "add to list", batch_task: "make a batch", ask: "ask", none: "nothing" };
    const parts = [
      html`<div class="section-head">${plan.name} <span class="badge ${low ? "today" : "ok"}">${low} low / out</span></div>
        <div class="inline-add"><input data-focus="pantry-${plan.id}" data-pantry-input="${plan.id}" maxlength="120" placeholder="Add staple or seasoning blend…" enterkeyhint="done">
        <button class="btn flat" data-action="pantry-add" data-plan="${plan.id}" aria-label="Add pantry item"><ha-icon icon="mdi:plus"></ha-icon></button>
        <button class="btn" data-action="s-open" data-context="pantry" data-plan="${plan.id}" title="Scan groceries as you put them away"><ha-icon icon="mdi:barcode-scan"></ha-icon>Scan</button></div>`,
    ];
    for (const [key, list] of groups) {
      parts.push(html`<div class="section"><div class="section-head">${key}</div>
        ${list.map(
          (item) => html`<div class="pantry-row">
            <div class="grow"><div class="summary">${item.is_batch ? "🧪 " : ""}${item.name}${item.quantity ? html` <span class="badge">${item.quantity}</span>` : ""}</div>
              <div class="meta">${item.mealie_recipe_slug
                ? this._board.mealie?.enabled
                  ? html`<button class="badge" data-action="c-open" data-slug="${item.mealie_recipe_slug}" data-name="${item.name}" title="Open the recipe"><ha-icon icon="mdi:chef-hat"></ha-icon>${item.mealie_recipe_slug}</button>`
                  : html`<span class="badge"><ha-icon icon="mdi:chef-hat"></ha-icon>${item.mealie_recipe_slug}</span>`
                : ""}
                <span class="badge">On low: ${actions[item.low_action] || item.low_action}</span>
                ${item.ingredients?.length ? html`<span class="badge">${item.ingredients.length} ingredients</span>` : ""}</div></div>
            <div class="seg">${[["in_stock", "In stock"], ["low", "Low"], ["out", "Out"]].map(
              ([s, l]) => html`<button class="${s} ${item.stock_state === s ? "on" : ""}" data-action="pantry-state" data-id="${item.id}" data-state="${s}">${l}</button>`,
            )}</div>
            <button class="icon-btn" data-action="pantry-edit" data-id="${item.id}" title="Edit" aria-label="Edit"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
          </div>`,
        )}</div>`);
    }
    if (!items.length) parts.push(html`<div class="empty">Track staples and homemade seasoning batches. Mark one Low and TaskDragon restocks it for you.</div>`);
    return html`${parts}`;
  }

  _renderBulkBar() {
    const bar = this.shadowRoot.querySelector(".td-bulkbar");
    if (!this._ui.bulk) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const n = this._ui.selected.size;
    const people = this._board.people || [];
    const off = n ? "" : html`disabled`;
    setHTML(
      bar,
      html`<strong>${n} selected</strong>
        <button class="btn small" data-action="bulk-do" data-id="complete" ${off}>Complete</button>
        <select data-bulk="assign" ${off} aria-label="Assign"><option value="">Assign…</option><option value="pool">Household pool</option>
          ${people.map((p) => html`<option value="${p.entity_id}">${p.name}</option>`)}</select>
        <select data-bulk="move" ${off} aria-label="Move"><option value="">Move to…</option>
          ${this._activePlans().filter((p) => p.archetype !== "pantry_spices" && p.archetype !== "wishlist_hoard").map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select>
        <select data-bulk="priority" ${off} aria-label="Priority"><option value="">Priority…</option>${PRIORITIES.map((p) => html`<option>${p}</option>`)}</select>
        <button class="btn small danger" data-action="bulk-do" data-id="delete" ${off}>Delete</button>
        <span class="grow" style="flex:1"></span>
        <button class="btn small flat" data-action="bulk-mode">Done</button>`,
    );
  }

  /* ---------------- Maintenance: data ---------------- */

  _maintData(planId) {
    return (this._maintBoards || {})[planId];
  }

  _queueMaintLoad(planId) {
    clearTimeout(this._maintTimer);
    this._maintTimer = setTimeout(() => this._loadMaint(planId), 120);
  }

  async _loadMaint(planId) {
    if (!planId || !this._store) return null;
    try {
      const board = await this._store.call({ type: "taskdragon/maint_board", plan_id: planId });
      this._maintBoards = { ...(this._maintBoards || {}), [planId]: board };
      this._maintError = null;
    } catch (err) {
      this._maintError = err.message || String(err);
    }
    if (this._maintPending === planId) this._maintPending = null;
    if (this._currentTab() === planId) {
      this._renderBody();
      if (this._ui.maint.taskId || this._ui.maint.objectId) this._mLoadHistory();
      // Countdowns and sensor progress move on their own; refresh while the view is open.
      clearTimeout(this._maintPoll);
      this._maintPoll = setTimeout(() => {
        if (this.isConnected && this._unsub && this._mPlanId() === planId && !document.hidden) this._loadMaint(planId);
      }, 60000);
    }
    return this._maintData(planId);
  }

  _mIdx(mb) {
    if (!mb.__idx) {
      mb.__idx = {
        tasks: new Map(mb.tasks.map((t) => [t.id, t])),
        objects: new Map(mb.objects.map((o) => [o.id, o])),
        parts: new Map(mb.parts.map((p) => [p.id, p])),
      };
    }
    return mb.__idx;
  }

  _mPlanId() {
    const tab = this._currentTab();
    return this._idx.plans.get(tab)?.archetype === "home_maintenance" ? tab : null;
  }

  _mBoard() {
    const planId = this._mPlanId();
    return planId ? this._maintData(planId) : null;
  }

  _mCurrency(mb) {
    return mb?.plan?.settings?.currency || "$";
  }

  _mPill(status) {
    const meta = MAINT_STATUS[status] || MAINT_STATUS.ok;
    return html`<span class="mpill ${meta.cls}"><ha-icon icon="${meta.icon}"></ha-icon>${meta.label}</span>`;
  }

  _mBarClass(status) {
    return (MAINT_STATUS[status] || MAINT_STATUS.ok).cls;
  }

  /* ---------------- Maintenance: layout ---------------- */

  _maintHtml(plan) {
    const mb = this._maintData(plan.id);
    if (!mb) {
      if (this._maintError) {
        return html`<div class="empty">Maintenance is unavailable: ${this._maintError} <button class="link" data-action="m-retry" data-id="${plan.id}">Retry</button></div>`;
      }
      if (this._maintPending !== plan.id) {
        this._maintPending = plan.id;
        this._queueMaintLoad(plan.id);
      }
      return html`<div class="empty">Loading maintenance…</div>`;
    }
    const ui = this._ui.maint;
    const idx = this._mIdx(mb);
    let body;
    if (ui.taskId && idx.tasks.has(ui.taskId)) body = this._mTaskDetail(mb, idx.tasks.get(ui.taskId));
    else if (ui.objectId && idx.objects.has(ui.objectId)) body = this._mObjectDetail(mb, idx.objects.get(ui.objectId));
    else if (ui.search && ui.query.trim()) body = this._mSearch(mb);
    else if (ui.view === "today") body = this._mToday(mb);
    else if (ui.view === "calendar") body = this._mCalendar(mb);
    else if (ui.view === "settings") body = this._mSettings(mb);
    else if (ui.view === "objects") body = this._mObjects(mb);
    else body = this._mDashboard(mb);
    return html`<div class="maint">${this._mHeader(mb)}${body}</div>`;
  }

  _mHeader(mb) {
    const ui = this._ui.maint;
    const s = mb.summary;
    const inList = !ui.taskId && !ui.objectId;
    const tile = (key, label, value, cls = "") => {
      const on = inList && ((key === "objects" && ui.view === "objects") || (ui.view === "dashboard" && ui.filter === key));
      return html`<button class="mtile ${cls} ${on ? "on" : ""}" data-action="m-tile" data-id="${key}"><span class="n">${value}</span><span class="l">${label}</span></button>`;
    };
    const tab = (key, label, icon) =>
      html`<button class="tab ${inList && !ui.search && ui.view === key ? "on" : ""}" data-action="m-view" data-id="${key}"><ha-icon icon="${icon}"></ha-icon>${label}</button>`;
    return html`<div class="msummary">
        ${tile("objects", "Objects", s.objects)}${tile("all", "Tasks", s.tasks)}${tile("overdue", "Overdue", s.overdue, "over")}${tile("due_soon", "Due soon", s.due_soon, "soon")}${tile("triggered", "Triggered", s.triggered, "trig")}
      </div>
      <div class="msubnav">
        ${tab("today", "Today", "mdi:calendar-today")}${tab("dashboard", "Dashboard", "mdi:view-dashboard-outline")}${tab("calendar", "Calendar", "mdi:calendar-month-outline")}${tab("settings", "Settings", "mdi:cog-outline")}
        <span class="grow"></span>
        ${ui.search ? html`<input class="msearch" data-focus="msearch" data-msearch type="search" maxlength="100" value="${ui.query}" placeholder="Search objects, tasks, parts, notes, documents…" aria-label="Search maintenance" autofocus>` : ""}
        <button class="icon-btn" data-action="m-search" title="Search" aria-label="Search maintenance"><ha-icon icon="${ui.search ? "mdi:close" : "mdi:magnify"}"></ha-icon></button>
      </div>`;
  }

  /* ---------------- Maintenance: rows & lists ---------------- */

  _mRow(task) {
    const ui = this._ui.maint;
    const pct = Math.max(0, Math.min(100, Math.round((task.progress || 0) * 100)));
    const person = task.assigned_to ? this._person(task.assigned_to) : null;
    const cls = this._mBarClass(task.status);
    return html`<div class="mrow ${ui.select ? "sel" : ""}" data-mtask="${task.id}">
      ${ui.select ? html`<input type="checkbox" class="sel" data-action="m-select" data-id="${task.id}" ${ui.selected.has(task.id) ? html`checked` : ""} aria-label="Select ${task.name}">` : ""}
      <div class="mrow-status">${this._mPill(task.status)}${task.nfc_tag_id ? html`<span class="mpill nfc" title="NFC tag linked">NFC</span>` : ""}</div>
      <div class="mrow-main">
        <div class="mrow-titles">
          <button class="mlink" data-action="m-object" data-id="${task.object_id}">${task.object_name}</button>
          <button class="mtitle" data-action="m-task" data-id="${task.id}">${task.name}</button>
          <span class="mcode">${task.code}</span>
        </div>
        <div class="mrow-meta">
          ${task.area_name ? html`<span class="mchip"><ha-icon icon="mdi:map-marker-outline"></ha-icon>${task.area_name}</span>` : ""}
          ${person ? html`<span class="mchip">${this._avatar(person)}${person.name}</span>` : ""}
          <span class="mcat">${task.category}</span>
          ${task.priority === "high" || task.priority === "urgent" ? html`<span class="badge ${task.priority}"><ha-icon icon="mdi:flag"></ha-icon>${task.priority}</span>` : ""}
        </div>
      </div>
      <div class="mrow-progress"><div class="mbar ${cls}" title="${task.countdown}"><span style="width:${pct}%"></span></div><span class="mcount">${task.countdown}</span></div>
      <div class="mrow-actions">
        <button class="mbtn ok" data-action="m-complete" data-id="${task.id}" ${task.require_nfc ? html`disabled title="Scan the NFC tag at the appliance"` : ""}><ha-icon icon="mdi:check"></ha-icon>Complete</button>
        <button class="mbtn skip" data-action="m-skip" data-id="${task.id}"><ha-icon icon="mdi:skip-next"></ha-icon>Skip</button>
      </div>
    </div>`;
  }

  _mSorted(list, sort) {
    const rank = (t) => -(MAINT_STATUS[t.status]?.rank || 0);
    const due = (t) => (t.days_left ?? 99999) - (t.status === "triggered" ? 100000 : 0) - Math.round((t.progress || 0) * 10);
    const cmp = {
      due: (a, b) => rank(a) - rank(b) || due(a) - due(b),
      area: (a, b) => (a.area_name || "~").localeCompare(b.area_name || "~") || due(a) - due(b),
      object: (a, b) => a.object_number - b.object_number || a.number - b.number,
      user: (a, b) => (a.assigned_to ? this._person(a.assigned_to).name : "~").localeCompare(b.assigned_to ? this._person(b.assigned_to).name : "~") || due(a) - due(b),
    }[sort] || ((a, b) => rank(a) - rank(b) || due(a) - due(b));
    return [...list].sort(cmp);
  }

  _mFiltered(mb) {
    const ui = this._ui.maint;
    let list = mb.tasks.filter((t) => !t.archived);
    if (ui.filter && ui.filter !== "all") list = list.filter((t) => t.status === ui.filter);
    if (ui.user === "none") list = list.filter((t) => !t.assigned_to);
    else if (ui.user && ui.user !== "all") list = list.filter((t) => t.assigned_to === ui.user);
    if (ui.priority && ui.priority !== "all") list = list.filter((t) => (t.priority || "none") === ui.priority);
    if (ui.area) list = list.filter((t) => t.area_id === ui.area);
    return this._mSorted(list, ui.sort);
  }

  _mGroups(list, group) {
    if (group === "none") return [["", list]];
    const key = {
      area: (t) => t.area_name || "No area",
      object: (t) => `${t.object_name}`,
      user: (t) => (t.assigned_to ? this._person(t.assigned_to).name : "Unassigned"),
      type: (t) => t.category,
    }[group];
    const groups = new Map();
    for (const task of list) {
      const name = key(task);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(task);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  _mDashboard(mb) {
    const ui = this._ui.maint;
    const people = this._board.people || [];
    const views = this._board?.prefs?.maint_views || [];
    const select = (name, value, options) =>
      html`<select data-mfilter="${name}" aria-label="${name}">${options.map(([v, l]) => html`<option value="${v}" ${v === value ? html`selected` : ""}>${l}</option>`)}</select>`;
    const list = this._mFiltered(mb);
    const groups = this._mGroups(list, ui.group);
    const area = ui.area ? (mb.areas.find((a) => a.area_id === ui.area)?.name || ui.area) : null;
    return html`<div class="mfilters">
        <label>Views<span class="toggle-group">${select("view", "", [["", "Current"], ...views.map((v, i) => [String(i), v.name])])}
          <button class="icon-btn sm" data-action="m-save-view" title="Save current view" aria-label="Save current view"><ha-icon icon="mdi:content-save-outline"></ha-icon></button></span></label>
        <label>Filter${select("filter", ui.filter, [["all", "All"], ["overdue", "Overdue"], ["due_soon", "Due soon"], ["triggered", "Triggered"], ["ok", "OK"]])}</label>
        <label>User${select("user", ui.user, [["all", "All users"], ["none", "Unassigned"], ...people.map((p) => [p.entity_id, p.name])])}</label>
        <label>Priority${select("priority", ui.priority, [["all", "Any"], ...PRIORITIES.map((p) => [p, p])])}</label>
        <label>Sort${select("sort", ui.sort, [["due", "Due date"], ["area", "Area"], ["object", "Object"], ["user", "User"]])}</label>
        <label>Group by${select("group", ui.group, [["none", "No grouping"], ["area", "Area"], ["object", "Object"], ["user", "User"], ["type", "Type"]])}</label>
        <span class="grow"></span>
        <button class="mbtn plain ${ui.select ? "on" : ""}" data-action="m-select-mode"><ha-icon icon="mdi:checkbox-multiple-marked-outline"></ha-icon>${ui.select ? "Done" : "Select"}</button>
        <span class="maddmenu">
          <button class="btn small" data-action="m-add-menu"><ha-icon icon="mdi:plus"></ha-icon>Add<ha-icon icon="mdi:menu-down"></ha-icon></button>
          ${ui.addMenu
            ? html`<div class="menu">
                <button data-action="m-new-object"><ha-icon icon="mdi:cube-outline"></ha-icon>New object</button>
                <button data-action="m-new-task"><ha-icon icon="mdi:wrench-outline"></ha-icon>New maintenance task</button>
                <button data-action="m-templates"><ha-icon icon="mdi:shape-plus-outline"></ha-icon>From template</button>
                <button data-action="m-fleet"><ha-icon icon="mdi:battery-sync-outline"></ha-icon>One-click battery fleet</button>
              </div>`
            : ""}
        </span>
      </div>
      ${area ? html`<div class="scope-bar"><span class="chip on">Area: ${area}</span><button class="link" data-action="m-clear-area">Show all areas</button></div>` : ""}
      ${ui.select ? this._mBulkBar() : ""}
      ${list.length
        ? groups.map(([name, tasks]) => html`<div class="mgroup">${name ? html`<div class="mgroup-head">${name}<span class="badge">${tasks.length}</span></div>` : ""}${tasks.map((t) => this._mRow(t))}</div>`)
        : html`<div class="empty">${mb.tasks.length ? "Nothing matches these filters." : "No maintenance tasks yet. Add an object (your furnace, water softener, car…) or start from a template."}</div>`}`;
  }

  _mBulkBar() {
    const ui = this._ui.maint;
    const n = ui.selected.size;
    const off = n ? "" : html`disabled`;
    return html`<div class="scope-bar"><strong>${n} selected</strong>
      <button class="mbtn ok" data-action="m-bulk" data-id="complete" ${off}>Complete</button>
      <button class="mbtn skip" data-action="m-bulk" data-id="skip" ${off}>Skip</button>
      <select data-mbulk="assign" ${off} aria-label="Assign"><option value="">Assign…</option><option value="__none">Unassigned</option>${(this._board.people || []).map((p) => html`<option value="${p.entity_id}">${p.name}</option>`)}</select>
      <button class="btn small danger" data-action="m-bulk" data-id="delete" ${off}>Delete</button></div>`;
  }

  _mToday(mb) {
    const tasks = mb.tasks.filter((t) => !t.archived);
    const today = mb.today;
    const sections = [
      ["Triggered", "mdi:flash-alert-outline", tasks.filter((t) => t.status === "triggered")],
      ["Overdue", "mdi:alert-circle-outline", tasks.filter((t) => t.status === "overdue")],
      ["Due soon", "mdi:clock-alert-outline", tasks.filter((t) => t.status === "due_soon")],
      ["Coming up in the next 30 days", "mdi:calendar-arrow-right", tasks.filter((t) => t.status === "ok" && t.days_left != null && t.days_left <= 30)],
    ];
    const warranties = mb.objects.filter((o) => o.warranty_days_left != null && o.warranty_days_left >= 0 && o.warranty_days_left <= (o.warranty_reminder_days || 30));
    const doneToday = mb.events.filter((e) => e.kind === "completed" && localISODate(new Date(e.occurred_at)) === today);
    const parts = [];
    for (const [label, icon, list] of sections) {
      if (!list.length) continue;
      parts.push(html`<div class="mgroup"><div class="mgroup-head"><ha-icon icon="${icon}"></ha-icon>${label}<span class="badge">${list.length}</span></div>${this._mSorted(list, "due").map((t) => this._mRow(t))}</div>`);
    }
    if (warranties.length) {
      parts.push(html`<div class="mcard"><h3><ha-icon icon="mdi:shield-alert-outline"></ha-icon>Warranties expiring</h3>${warranties.map(
        (o) => html`<div class="mdoc"><button class="mlink grow" data-action="m-object" data-id="${o.id}">${o.name} ${o.code}</button><span class="badge today">${usDate(o.warranty_expiry_date)} · ${o.warranty_days_left} days</span></div>`,
      )}</div>`);
    }
    if (doneToday.length) {
      parts.push(html`<div class="mcard"><h3><ha-icon icon="mdi:check-all"></ha-icon>Done today</h3>${doneToday.map((e) => this._mEventHtml(e, mb))}</div>`);
    }
    if (!parts.length) parts.push(html`<div class="empty">Nothing needs attention today. 🎉</div>`);
    return html`${parts}`;
  }

  /* ---------------- Maintenance: calendar ---------------- */

  _mAddInterval(iso, value, unit) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (unit === "days") date.setUTCDate(date.getUTCDate() + value);
    else if (unit === "weeks") date.setUTCDate(date.getUTCDate() + 7 * value);
    else {
      const months = unit === "years" ? 12 * value : value;
      const target = new Date(Date.UTC(y, m - 1 + months, 1));
      const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(d, last));
      return target.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }

  _mCalendar(mb) {
    const ui = this._ui.maint;
    const month = ui.calMonth || mb.today.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const start = new Date(first);
    start.setUTCDate(1 - first.getUTCDay());
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const items = new Map();
    const add = (day, item) => {
      if (!items.has(day)) items.set(day, []);
      items.get(day).push(item);
    };
    for (const task of mb.tasks.filter((t) => !t.archived && t.next_due)) {
      add(task.next_due, { task, cls: MAINT_STATUS[task.status]?.cls || "ok" });
      if (task.interval_value && ["rolling", "planned"].includes(task.schedule_mode)) {
        let next = task.next_due;
        for (let i = 0; i < 24; i += 1) {
          next = this._mAddInterval(next, task.interval_value, task.interval_unit);
          if (next > monthEnd) break;
          add(next, { task, cls: "proj" });
        }
      }
    }
    for (const event of mb.events.filter((e) => e.kind === "completed" && e.task_id)) {
      add(localISODate(new Date(event.occurred_at)), { task: { id: event.task_id, name: event.task_name, object_name: event.object_name }, cls: "done" });
    }
    const days = [];
    for (let i = 0; i < 42; i += 1) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      const iso = day.toISOString().slice(0, 10);
      const list = items.get(iso) || [];
      days.push(html`<div class="day ${iso.slice(0, 7) !== month ? "out" : ""} ${iso === mb.today ? "today" : ""}">
        <span class="num">${day.getUTCDate()}</span>
        ${list.slice(0, 4).map((it) => html`<button class="item ${it.cls}" data-action="m-task" data-id="${it.task.id}" title="${it.task.object_name}: ${it.task.name}">${it.task.name}</button>`)}
        ${list.length > 4 ? html`<span class="lastdone">+${list.length - 4} more</span>` : ""}
      </div>`);
    }
    const shift = (delta) => {
      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
      return d.toISOString().slice(0, 7);
    };
    return html`<div class="section-head">
        <button class="icon-btn sm" data-action="m-cal" data-id="${shift(-1)}" aria-label="Previous month"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
        <span>${MONTH_NAMES[m - 1]} ${y}</span>
        <button class="icon-btn sm" data-action="m-cal" data-id="${shift(1)}" aria-label="Next month"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
        <span class="grow"></span><button class="link" data-action="m-cal" data-id="${mb.today.slice(0, 7)}">Today</button></div>
      <div class="mcal">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => html`<span class="dow">${d}</span>`)}${days}</div>
      <div class="lastdone">Dashed entries are projected future cycles; crossed-out ones were completed.</div>`;
  }

  /* ---------------- Maintenance: settings & spend ---------------- */

  _mSettings(mb) {
    const s = mb.plan.settings;
    const admin = this._isAdmin();
    const shopping = this._activePlans().filter((p) => p.archetype === "shopping_errands");
    const chores = this._activePlans().filter((p) => p.archetype === "daily_chores");
    const spend = mb.spend;
    const max = Math.max(1, ...spend.by_month);
    return html`<div class="mcard"><h3><ha-icon icon="mdi:cog-outline"></ha-icon>Maintenance settings</h3>
        <div class="form msettings-form">
          <label>Cost accounting<select name="cost_mode">
            <option value="consumption" ${s.cost_mode === "consumption" ? html`selected` : ""}>Book part cost when a task uses it</option>
            <option value="purchase" ${s.cost_mode === "purchase" ? html`selected` : ""}>Book part cost when it is bought</option></select></label>
          <label>Currency symbol<input name="currency" maxlength="8" value="${s.currency}"></label>
          <label>Default warning (days before due)<input name="default_warning_days" type="number" min="0" max="365" value="${s.default_warning_days}"></label>
          <label>Notify service ${admin ? "" : html`<span class="lastdone">(administrators only)</span>`}<input name="notify_service" maxlength="100" value="${s.notify_service || ""}" placeholder="notify.mobile_app_phone" ${admin ? "" : html`disabled`}></label>
          <label>Restock parts on<select name="shopping_plan_id"><option value="">Hardware list (default)</option>${shopping.map((p) => html`<option value="${p.id}" ${s.shopping_plan_id === p.id ? html`selected` : ""}>${p.name}</option>`)}</select></label>
          <label>"Buy …" tasks go to<select name="chore_plan_id"><option value="">Default chores plan</option>${chores.map((p) => html`<option value="${p.id}" ${s.chore_plan_id === p.id ? html`selected` : ""}>${p.name}</option>`)}</select></label>
        </div>
        <div class="dialog-actions"><button class="btn" data-action="m-save-settings">Save settings</button></div>
      </div>
      <div class="mcard"><h3><ha-icon icon="mdi:cash-multiple"></ha-icon>Spend ${spend.year}<span class="grow"></span><span>${money(spend.total, s.currency)}</span></h3>
        <div class="lastdone">${spend.mode === "purchase" ? "Parts are booked when they are bought." : "Parts are booked when a task uses them."}</div>
        <div class="mspend">${spend.by_month.map((v, i) => html`<div class="bar" style="height:${Math.round((v / max) * 100)}%" title="${MONTH_NAMES[i]}: ${money(v, s.currency)}"></div>`)}</div>
        <div class="mspend-labels">${MONTH_NAMES.map((n) => html`<span>${n}</span>`)}</div>
        <table class="mtable"><tbody>
          ${spend.by_area.length ? spend.by_area.map((r) => html`<tr><td>📍 ${r.area}</td><td class="r">${money(r.total, s.currency)}</td></tr>`) : html`<tr><td class="lastdone">No costs recorded this year.</td></tr>`}
        </tbody></table>
        ${Object.keys(spend.by_year).length > 1 ? html`<div class="lastdone">By year: ${Object.entries(spend.by_year).map(([y, v]) => `${y}: ${money(v, s.currency)}`).join(" · ")}</div>` : ""}
      </div>`;
  }

  /* ---------------- Maintenance: objects & search ---------------- */

  _mObjects(mb) {
    const children = new Map();
    for (const obj of mb.objects) {
      const key = obj.parent_object_id && mb.objects.some((o) => o.id === obj.parent_object_id) ? obj.parent_object_id : "";
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(obj);
    }
    const nodes = [];
    const walk = (parent, depth) => {
      for (const obj of children.get(parent) || []) {
        nodes.push(html`<button class="node" data-action="m-object" data-id="${obj.id}" style="padding-left:${8 + depth * 24}px">
          <ha-icon icon="${obj.icon || (obj.object_type === "water_softener" ? "mdi:water-opacity" : "mdi:cube-outline")}"></ha-icon>
          <span class="grow"><strong>${obj.name}</strong> <span class="mcode">${obj.code}</span><div class="lastdone">${[obj.manufacturer_model, obj.area_name].filter(Boolean).join(" · ")}</div></span>
          <span class="badge">${obj.task_count} task${obj.task_count === 1 ? "" : "s"}</span>${this._mPill(obj.status)}</button>`);
        walk(obj.id, depth + 1);
      }
    };
    walk("", 0);
    return html`<div class="section-head">Objects<span class="grow"></span>
        <button class="link" data-action="m-templates">From template</button><button class="btn small" data-action="m-new-object"><ha-icon icon="mdi:plus"></ha-icon>New object</button></div>
      <div class="mtree">${nodes.length ? nodes : html`<div class="empty">No objects yet.</div>`}</div>`;
  }

  _mSearch(mb) {
    const q = this._ui.maint.query.trim().toLowerCase();
    const has = (...values) => values.some((v) => String(v || "").toLowerCase().includes(q));
    const objects = mb.objects.filter((o) => has(o.name, o.manufacturer_model, o.notes, o.area_name, o.code));
    const tasks = mb.tasks.filter((t) => has(t.name, t.notes, t.spec_note, t.category, t.code, t.object_name));
    const parts = mb.parts.filter((p) => has(p.part_name, p.mpn_gtin, p.storage_location, p.notes));
    const docs = mb.documents.filter((d) => has(d.title, d.filename, d.category));
    const notes = mb.events.filter((e) => has(e.notes));
    const result = (action, id, icon, title, sub) =>
      html`<button class="mresult" data-action="${action}" data-id="${id}"><ha-icon icon="${icon}"></ha-icon><span class="grow"><strong>${title}</strong><div class="lastdone">${sub}</div></span></button>`;
    const total = objects.length + tasks.length + parts.length + docs.length + notes.length;
    return html`<div class="section-head">${total} result${total === 1 ? "" : "s"} for “${this._ui.maint.query}”</div>
      ${objects.map((o) => result("m-object", o.id, "mdi:cube-outline", `${o.name} ${o.code}`, [o.manufacturer_model, o.area_name].filter(Boolean).join(" · ") || "Object"))}
      ${tasks.map((t) => result("m-task", t.id, "mdi:wrench-outline", `${t.name} ${t.code}`, `${t.object_name} · ${t.category} · ${t.countdown}`))}
      ${parts.map((p) => result("m-part-edit", p.id, "mdi:package-variant-closed", p.part_name, `Stock ${p.current_stock}${p.storage_location ? ` · ${p.storage_location}` : ""}`))}
      ${docs.map((d) => result("m-doc-open", d.id, DOC_ICONS[d.category] || DOC_ICONS.other, d.title, `${d.category} · ${d.kind === "link" ? "link" : d.filename}`))}
      ${notes.map((e) => result("m-task", e.task_id || "", "mdi:note-text-outline", e.notes, `${e.code} · ${usDate(e.occurred_at)}`))}
      ${total ? "" : html`<div class="empty">Nothing found.</div>`}`;
  }

  /* ---------------- Maintenance: events ---------------- */

  _mEventHtml(event, mb) {
    const kind = event.kind;
    const icon = { completed: "mdi:check", skipped: "mdi:skip-next", missed: "mdi:calendar-remove", purchase: "mdi:cart-check", salt: "mdi:shaker", regeneration: "mdi:sync", part_used: "mdi:package-down" }[kind] || "mdi:circle-small";
    const who = event.person_entity_id ? this._person(event.person_entity_id).name : event.user_name;
    let label = EVENT_LABELS[kind] || kind;
    if (kind === "completed" && METHOD_LABELS[event.method]) label = `${label} — ${METHOD_LABELS[event.method]}`;
    if (kind === "salt") label = `Salt: ${event.data?.kind === "fill" ? "filled" : event.data?.kind === "empty" ? "tank empty / bridges checked" : "level observed"}${event.data?.label ? ` (${event.data.label})` : ""}`;
    if (kind === "regeneration") label = `Regeneration detected (${event.data?.volume ?? "?"} ${event.data?.unit || "gal"}, ${event.data?.minutes ?? "?"} min)`;
    if (kind === "purchase") label = `Restocked ${event.data?.quantity ?? ""} × ${event.data?.part_name || "part"}${event.method === "scan" ? " (scanned)" : ""}`;
    if (kind === "part_used") label = `Used ${event.data?.quantity ?? 1} × ${event.data?.part_name || "part"}${event.method === "scan" ? " (scanned)" : ""}`;
    const when = new Date(event.occurred_at);
    const currency = this._mCurrency(mb);
    const parts = (event.data?.parts || []).map((p) => `${p.quantity}× ${p.part_name}`).join(", ");
    const photo = event.photo_doc_id ? mb.documents.find((d) => d.id === event.photo_doc_id) : null;
    return html`<div class="mevent"><span class="dot ${kind}"><ha-icon icon="${icon}"></ha-icon></span>
      <div class="body"><div><strong>${label}</strong> ${event.code ? html`<span class="mid">${event.code}</span>` : ""}</div>
        <div class="when">${usDate(event.occurred_at)} ${fmtTime(when)}${who ? ` · ${who}` : ""}${event.total_cost ? ` · ${money(event.total_cost, currency)}` : ""}${event.duration_minutes ? ` · ${event.duration_minutes} min` : ""}${event.feedback ? ` · ${event.feedback.replace("_", " ")}` : ""}</div>
        ${event.task_name && !this._ui.maint.taskId ? html`<div class="lastdone">${event.object_name} › ${event.task_name}</div>` : ""}
        ${parts ? html`<div class="lastdone">Parts: ${parts}</div>` : ""}
        ${event.notes ? html`<div class="note">${event.notes}</div>` : ""}
        ${photo ? html`<button class="link" data-action="m-doc-open" data-id="${photo.id}"><ha-icon icon="mdi:image-outline"></ha-icon> Completion photo</button>` : ""}
      </div></div>`;
  }

  /* ---------------- Maintenance: task detail ---------------- */

  _mTaskDetail(mb, t) {
    const ui = this._ui.maint;
    const currency = this._mCurrency(mb);
    const obj = this._mIdx(mb).objects.get(t.object_id);
    const events = this._mHistory?.[t.id] || mb.events.filter((e) => e.task_id === t.id);
    const parts = (t.parts || []).map((link) => ({ ...link, part: this._mIdx(mb).parts.get(link.part_id) })).filter((p) => p.part);
    const manual = t.manual_doc_id ? mb.documents.find((d) => d.id === t.manual_doc_id) : null;
    const pct = Math.max(0, Math.min(100, Math.round((t.progress || 0) * 100)));
    const daysValue = t.days_left != null ? (t.days_left < 0 ? `${t.days_left}` : `${t.days_left}`) : "—";
    const kpi = (k, v, big = false) => html`<div class="mkpi"><div class="k">${k}</div><div class="v ${big ? "big" : ""}">${v}</div></div>`;
    const history = ui.taskTab === "history";
    const rec = t.recommendation;
    return html`<div class="mcrumb"><button data-action="m-back" data-id="list"><ha-icon icon="mdi:arrow-left"></ha-icon> Maintenance</button> /
        <button data-action="m-object" data-id="${t.object_id}">${t.object_name}</button> / <span>${t.name}</span></div>
      <div class="mhead">
        <div class="grow"><h2>${t.name}<span class="mid">${t.code}</span>${this._mPill(t.status)}${t.nfc_tag_id ? html`<span class="mpill nfc">NFC</span>` : ""}</h2>
          <div class="msub"><button class="mlink" data-action="m-object" data-id="${t.object_id}">${t.object_name}</button><span>${t.category}</span>
            ${t.assigned_to ? html`<span class="mchip">${this._avatar(this._person(t.assigned_to))}${this._person(t.assigned_to).name}${(t.rotation || []).length > 1 ? " · rotates" : ""}</span>` : ""}
            ${t.reasons?.length ? html`<span class="badge overdue">${t.reasons.join(" · ")}</span>` : ""}</div></div>
        <div class="mhead-actions">
          <button class="mbtn ok" data-action="m-complete-dialog" data-id="${t.id}" ${t.require_nfc ? html`disabled title="Scan the NFC tag at the appliance"` : ""}><ha-icon icon="mdi:check"></ha-icon>Complete</button>
          <button class="mbtn skip" data-action="m-skip" data-id="${t.id}"><ha-icon icon="mdi:skip-next"></ha-icon>Skip</button>
          <button class="icon-btn" data-action="m-head-menu" aria-label="More"><ha-icon icon="mdi:dots-vertical"></ha-icon></button>
          ${ui.headMenu
            ? html`<div class="menu">
                <button data-action="m-edit-task" data-id="${t.id}"><ha-icon icon="mdi:pencil-outline"></ha-icon>Edit task</button>
                <button data-action="m-qr" data-id="${t.id}" data-kind="task"><ha-icon icon="mdi:qrcode"></ha-icon>QR code</button>
                <button data-action="m-nfc-listen" data-id="${t.id}"><ha-icon icon="mdi:nfc-variant"></ha-icon>Bind NFC tag (scan now)</button>
                <button data-action="m-delete-task" data-id="${t.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete task</button>
              </div>`
            : ""}
        </div>
      </div>
      ${mb.nfc_listening === t.id ? html`<div class="banner"><ha-icon icon="mdi:nfc-search-variant"></ha-icon>Scan the NFC tag now — the next tag Home Assistant sees is linked to this task.</div>` : ""}
      <div class="mtabs"><button class="tab ${history ? "" : "on"}" data-action="m-task-tab" data-id="overview">Overview</button><button class="tab ${history ? "on" : ""}" data-action="m-task-tab" data-id="history">History <span class="count">${events.length}</span></button></div>
      ${history
        ? html`<div class="mcard">${events.length ? events.map((e) => this._mEventHtml(e, mb)) : html`<div class="empty sm">No history yet.</div>`}</div>`
        : html`<div class="mkpis">
              ${kpi("Next due", usDate(t.next_due))}
              ${kpi("Days until due", t.days_left != null ? daysValue : t.countdown, t.days_left != null)}
              ${kpi("Interval", t.schedule_mode === "none" ? "Sensor" : t.schedule_mode === "once" ? "Once" : `${t.interval_label}${t.schedule_mode === "planned" ? " (planned)" : ""}`)}
              ${kpi("Warning", `${t.warning_days} days`)}
              ${kpi("Last performed", usDate(t.last_done))}
              ${kpi("Avg cost", t.stats.avg_cost != null ? money(t.stats.avg_cost, currency) : `0 ${currency}`)}
              ${kpi("Avg duration", t.stats.avg_duration != null ? `${t.stats.avg_duration} min` : "—")}
            </div>
            ${t.spec_note || parts.length || manual
              ? html`<div class="mcallout"><ha-icon icon="mdi:file-document-outline"></ha-icon><span class="grow">
                  ${t.spec_note ? html`<div><strong>${t.spec_note}</strong></div>` : ""}
                  ${parts.map((p) => html`<div>${p.quantity}× ${p.part.part_name} <span class="mstock ${p.part.low ? "low" : ""}">${p.part.current_stock} in stock</span></div>`)}</span>
                  ${manual ? html`<button class="btn small flat" data-action="m-doc-open" data-id="${manual.id}" data-page="${t.manual_page || ""}"><ha-icon icon="mdi:book-open-variant"></ha-icon>${manual.title}${t.manual_page ? ` · p. ${t.manual_page}` : ""}</button>` : ""}
                </div>`
              : ""}
            ${t.next_due
              ? html`<div class="mtimeline"><div class="ends"><span>Last performed: ${usDate(t.last_done)}</span><span>Next due: ${usDate(t.next_due)}</span></div>
                  <div class="mbar ${this._mBarClass(t.status)}"><span style="width:${pct}%"></span></div><div class="mid-label">${t.countdown}</div></div>`
              : ""}
            ${(t.triggers || []).length
              ? html`<div class="mcard"><h3><ha-icon icon="mdi:access-point"></ha-icon>Sensor triggers <span class="badge">${t.trigger_logic === "and" ? "all must be met" : "any one is enough"}</span></h3>
                  ${t.triggers.map(
                    (tr) => html`<div class="mtrig"><div class="row"><span>${(MAINT_TRIGGERS.find(([k]) => k === tr.type) || [tr.type, tr.type])[1].split(" (")[0]}${tr.entity_id ? html` · <code>${tr.entity_id}</code>` : ""}</span><span class="${tr.met ? "badge overdue" : "lastdone"}">${tr.met ? "Met" : ""}</span></div>
                      <div class="mbar ${tr.met ? "trig" : tr.progress >= 0.9 ? "soon" : "ok"}"><span style="width:${Math.min(100, Math.round(tr.progress * 100))}%"></span></div><div class="lastdone">${tr.label}</div></div>`,
                  )}</div>`
              : ""}
            ${rec
              ? html`<div class="mcard"><h3><ha-icon icon="mdi:chart-bell-curve-cumulative"></ha-icon>Adaptive interval</h3>
                  <div class="mrec"><span class="grow">${rec.suggest ? html`Suggested: <strong>${rec.label}</strong> (${rec.interval_days} days, ${rec.change_percent > 0 ? "+" : ""}${rec.change_percent}% vs now)` : html`The current interval fits your history (${rec.label} suggested).`}
                    <div class="lastdone">${rec.samples} completion${rec.samples === 1 ? "" : "s"} · ${rec.confidence} confidence · EWA ${rec.ewa_days} d${rec.weibull ? ` · Weibull B10 ${rec.weibull.b10_days} d (k=${rec.weibull.shape})` : ""}${rec.seasonal_multiplier !== 1 ? ` · seasonal ×${rec.seasonal_multiplier}` : ""}</div></span>
                    ${rec.suggest ? html`<button class="btn small" data-action="m-apply-rec" data-id="${t.id}">Apply recommended interval</button>` : ""}
                    <button class="btn small flat" data-action="m-reanalyze" data-id="${t.id}">Re-analyze</button></div></div>`
              : ""}
            ${t.notes ? html`<div class="mcallout"><ha-icon icon="mdi:note-text-outline"></ha-icon><span class="grow" data-markdown="${t.notes}"></span></div>` : ""}
            <div class="mcard"><h3><ha-icon icon="mdi:history"></ha-icon>Recent activities<span class="grow"></span>${events.length > 5 ? html`<button class="link" data-action="m-task-tab" data-id="history">Show all →</button>` : ""}</h3>
              ${events.length ? events.slice(0, 5).map((e) => this._mEventHtml(e, mb)) : html`<div class="empty sm">Not done yet.</div>`}</div>`}`;
  }

  /* ---------------- Maintenance: object detail ---------------- */

  _mAccordion(key, title, count, body, extra = html``) {
    const open = this._ui.maint.open[key] !== false;
    return html`<div class="macc"><div class="macc-head">
        <button class="collapse-btn ${open ? "" : "closed"}" data-action="m-acc" data-id="${key}" aria-expanded="${open}"><ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="title">${title} (${count})</span></button>${extra}</div>
      ${open ? html`<div class="macc-body">${body}</div>` : ""}</div>`;
  }

  _mSaltGauge(obj) {
    const s = obj.salt || {};
    const unit = s.unit || "gal";
    const markers = s.markers || [];
    const label = (v) => (s.scale === "percent" ? `${v}%` : s.scale === "bags" ? `${v} bags` : `Level ${v}`);
    if (!s.known) {
      return html`<div class="mcard"><h3><ha-icon icon="mdi:shaker-outline"></ha-icon>Salt level</h3>
        <div class="lastdone">${s.message || "Log a fill or the current level to start tracking."}${obj.config?.volume_entity ? "" : " Link a total water volume sensor (e.g. Droplet) in Edit to learn how fast salt is used."}</div>
        <div class="mtank-actions"><button class="btn small" data-action="m-salt-fill" data-id="${obj.id}"><ha-icon icon="mdi:shaker"></ha-icon>Filled salt</button>
          ${markers.map((v) => html`<button class="chip mlevel" data-action="m-salt-level" data-id="${obj.id}" data-level="${v}">${label(v)}</button>`)}</div></div>`;
    }
    const pct = Math.round(s.fraction * 100);
    const span = (s.scale === "levels" ? s.max_level - s.min_level : s.scale === "percent" ? 100 : s.capacity_bags) || 1;
    const pos = (v) => (s.scale === "levels" ? (v - s.min_level) / span : s.scale === "percent" ? v / 100 : v / span);
    const stat = (k, v) => html`<div class="mkpi"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const fmt = (n) => (n == null ? "—" : Math.round(n).toLocaleString());
    return html`<div class="mcard"><h3><ha-icon icon="mdi:shaker-outline"></ha-icon>Salt level<span class="grow"></span><span class="badge ${s.confidence === "calibrated" ? "ok" : ""}">${s.confidence}${s.segments ? ` · ${s.segments} calibration${s.segments === 1 ? "" : "s"}` : ""}</span></h3>
      <div class="mtank-wrap">
        <div class="mtank" role="img" aria-label="Estimated salt ${s.label}">
          <div class="salt ${s.below_warning ? "low" : ""}" style="height:${pct}%"></div>
          ${markers.filter((v) => pos(v) > 0 && pos(v) < 1).map((v) => html`<div class="mark" style="bottom:${Math.round(pos(v) * 100)}%">${s.scale === "levels" ? v : ""}</div>`)}
          <div class="mark warn" style="bottom:${Math.round((s.warning_fraction || 0) * 100)}%"></div>
        </div>
        <div class="mtank-stats">
          ${stat("Estimated level", s.label)}
          ${stat("Since refill", s.since_refill != null ? `${fmt(s.since_refill)} ${unit}` : "—")}
          ${stat("Until refill needed", `${fmt(s.remaining_to_warning)} ${unit}`)}
          ${stat("Days until refill", s.days_until_refill != null ? `~${Math.round(s.days_until_refill)}` : "—")}
          ${stat("Days until empty", s.days_until_empty != null ? `~${Math.round(s.days_until_empty)}` : "—")}
          ${stat("Learned rate", `${fmt(s.per_unit)} ${unit} / ${s.scale === "percent" ? "%" : s.scale === "bags" ? "bag" : "level"}`)}
          ${stat("Daily use (14 d)", `${fmt(s.daily_use)} ${unit}`)}
          ${s.regenerations ? stat("Last regeneration", `${usDate(s.regenerations.ended_at)} · ${fmt(s.regenerations.volume)} ${unit}`) : ""}
        </div>
      </div>
      <div class="mtank-actions">
        <button class="btn small" data-action="m-salt-fill" data-id="${obj.id}"><ha-icon icon="mdi:shaker"></ha-icon>Filled salt</button>
        <span class="lastdone">Salt is at:</span>
        ${markers.filter((v) => pos(v) > 0).map((v) => html`<button class="chip mlevel" data-action="m-salt-level" data-id="${obj.id}" data-level="${v}">${label(v)}</button>`)}
        <button class="btn small flat" data-action="m-salt-empty" data-id="${obj.id}"><ha-icon icon="mdi:tray-remove"></ha-icon>Tank empty / bridges checked</button>
      </div></div>`;
  }

  _mObjectDetail(mb, obj) {
    const ui = this._ui.maint;
    const currency = this._mCurrency(mb);
    const tasks = this._mSorted(mb.tasks.filter((t) => t.object_id === obj.id), "object");
    const docs = mb.documents.filter((d) => d.object_id === obj.id);
    const taskIds = new Set(tasks.map((t) => t.id));
    const parts = mb.parts.filter((p) => p.object_id === obj.id || (p.bound_tasks || []).some((id) => taskIds.has(id)));
    const parent = obj.parent_object_id ? this._mIdx(mb).objects.get(obj.parent_object_id) : null;
    const children = mb.objects.filter((o) => o.parent_object_id === obj.id);
    const history = this._mHistory?.[obj.id] || mb.events.filter((e) => e.object_id === obj.id);
    const filtered = history.filter((e) => {
      if (ui.histTask && e.task_id !== ui.histTask) return false;
      const day = localISODate(new Date(e.occurred_at));
      if (ui.histFrom && day < ui.histFrom) return false;
      if (ui.histTo && day > ui.histTo) return false;
      return true;
    });
    // Same rule as the PDF: parts count once, when used or when bought (the plan's cost setting).
    const mode = mb.plan.settings.cost_mode;
    const amount = (e) => (e.kind === "completed" ? (e.cost || 0) + (mode === "consumption" ? e.parts_cost || 0 : 0) : e.kind === "purchase" && mode === "purchase" ? e.cost || 0 : 0);
    const total = Math.round(filtered.reduce((sum, e) => sum + amount(e), 0) * 100) / 100;
    const inventory = parts.reduce((sum, p) => sum + (p.inventory_value || 0), 0);
    return html`<div class="mcrumb"><button data-action="m-back" data-id="list"><ha-icon icon="mdi:arrow-left"></ha-icon> Maintenance</button>
        ${parent ? html` / <button data-action="m-object" data-id="${parent.id}">${parent.name}</button>` : ""} / <span>${obj.name}</span></div>
      <div class="mhead">
        <div class="grow"><h2><ha-icon icon="${obj.icon || "mdi:cube-outline"}"></ha-icon>${obj.name}<span class="mid">${obj.code}</span>${this._mPill(obj.status)}</h2>
          <div class="msub">${obj.manufacturer_model ? html`<span>${obj.manufacturer_model}</span>` : ""}
            ${obj.area_name ? html`<span>Area: <button class="mlink" data-action="m-area" data-id="${obj.area_id}">${obj.area_name}</button></span>` : ""}
            ${obj.installed_date ? html`<span>Installed: ${usDate(obj.installed_date)}</span>` : ""}
            ${obj.warranty_expiry_date ? html`<span class="${obj.warranty_days_left != null && obj.warranty_days_left <= (obj.warranty_reminder_days || 30) ? "badge today" : ""}">Warranty: ${usDate(obj.warranty_expiry_date)}</span>` : ""}
            ${obj.zone_entity_id ? html`<span class="mchip"><ha-icon icon="mdi:map-marker-radius-outline"></ha-icon>${this._hass?.states[obj.zone_entity_id]?.attributes?.friendly_name || obj.zone_entity_id}</span>` : ""}</div></div>
        <div class="mhead-actions">
          <button class="btn small" data-action="m-new-task" data-id="${obj.id}"><ha-icon icon="mdi:plus"></ha-icon>Add task</button>
          <button class="btn small flat" data-action="m-edit-object" data-id="${obj.id}"><ha-icon icon="mdi:pencil-outline"></ha-icon>Edit</button>
          <button class="icon-btn" data-action="m-head-menu" aria-label="More"><ha-icon icon="mdi:dots-vertical"></ha-icon></button>
          ${ui.headMenu
            ? html`<div class="menu">
                <button data-action="m-qr" data-id="${obj.id}" data-kind="object"><ha-icon icon="mdi:qrcode"></ha-icon>QR code</button>
                <button data-action="m-pdf" data-id="${obj.id}"><ha-icon icon="mdi:printer-outline"></ha-icon>Service record (PDF)</button>
                <button data-action="m-new-child" data-id="${obj.id}"><ha-icon icon="mdi:file-tree-outline"></ha-icon>Add object inside</button>
                <button data-action="m-delete-object" data-id="${obj.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete object</button>
              </div>`
            : ""}
        </div>
      </div>
      ${obj.notes ? html`<div class="mcallout"><ha-icon icon="mdi:information-outline"></ha-icon><span class="grow" data-markdown="${obj.notes}"></span></div>` : ""}
      ${children.length ? html`<div class="scope-bar">${children.map((c) => html`<button class="chip" data-action="m-object" data-id="${c.id}">${c.name} ${c.code}</button>`)}</div>` : ""}
      ${this._mAccordion(
        "tasks",
        "Tasks",
        tasks.length,
        html`${obj.object_type === "water_softener" ? this._mSaltGauge(obj) : ""}${tasks.length ? tasks.map((t) => this._mRow(t)) : html`<div class="empty sm">No tasks yet.</div>`}`,
      )}
      ${this._mAccordion(
        "docs",
        "Documents",
        docs.length,
        html`${docs.length
          ? docs.map(
              (d) => html`<div class="mdoc"><ha-icon icon="${d.kind === "link" ? "mdi:link-variant" : DOC_ICONS[d.category] || DOC_ICONS.other}"></ha-icon>
                <button class="mlink grow" data-action="m-doc-open" data-id="${d.id}">${d.title}</button><span class="badge">${d.category}</span>
                ${d.size ? html`<span class="lastdone">${Math.max(1, Math.round(d.size / 1024))} KB</span>` : ""}
                <button class="icon-btn sm" data-action="m-doc-delete" data-id="${d.id}" aria-label="Delete ${d.title}"><ha-icon icon="mdi:delete-outline"></ha-icon></button></div>`,
            )
          : html`<div class="empty sm">Manuals, invoices, warranties and photos live here.</div>`}`,
        html`<span class="grow"></span>
          <select data-mdoc-cat aria-label="Document category">${DOC_CATEGORIES_UI.map((c) => html`<option value="${c}" ${ui.docCat === c ? html`selected` : ""}>${c[0].toUpperCase() + c.slice(1)}</option>`)}</select>
          <label class="btn small flat mupload"><ha-icon icon="mdi:upload"></ha-icon>Upload file<input type="file" hidden data-mupload="${obj.id}" accept="application/pdf,image/*,.txt"></label>
          <label class="icon-btn sm mupload" title="Take a photo" aria-label="Take a photo"><ha-icon icon="mdi:camera-outline"></ha-icon><input type="file" hidden data-mupload="${obj.id}" accept="image/*" capture="environment"></label>
          <button class="btn small flat" data-action="m-add-link" data-id="${obj.id}"><ha-icon icon="mdi:link-variant-plus"></ha-icon>Add link</button>`,
      )}
      ${this._mAccordion(
        "parts",
        "Parts & consumables",
        parts.length,
        html`${parts.length
          ? parts.map(
              (p) => html`<div class="mpart"><span><strong>${p.part_name}</strong>${p.pending ? html` <span class="badge ok">on the list</span>` : ""}
                  <div class="lastdone">${[p.mpn_gtin, p.storage_location, p.unit_cost != null ? `${money(p.unit_cost, currency)} each` : null, `reorder at ${p.reorder_threshold}`].filter(Boolean).join(" · ")}</div></span>
                <span class="mstock ${p.low ? "low" : ""}">${p.current_stock} in stock</span>
                <span class="toggle-group"><button class="icon-btn sm" data-action="m-stock" data-id="${p.id}" data-delta="-1" aria-label="One less"><ha-icon icon="mdi:minus"></ha-icon></button>
                  <button class="icon-btn sm" data-action="m-stock" data-id="${p.id}" data-delta="1" aria-label="One more"><ha-icon icon="mdi:plus"></ha-icon></button>
                  <button class="icon-btn sm" data-action="m-part-edit" data-id="${p.id}" aria-label="Edit ${p.part_name}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button></span></div>`,
            )
          : html`<div class="empty sm">Track filters, cartridges, salt and other consumables.</div>`}
          ${inventory ? html`<div class="lastdone">Inventory value: ${money(inventory, currency)}</div>` : ""}`,
        html`<span class="grow"></span><button class="btn small" data-action="s-open" data-context="maintenance" data-object="${obj.id}" title="Scan a filter box, salt bag or other consumable"><ha-icon icon="mdi:barcode-scan"></ha-icon>Scan</button>
          <button class="btn small flat" data-action="m-new-part" data-id="${obj.id}"><ha-icon icon="mdi:plus"></ha-icon>Add part</button>`,
      )}
      ${this._mAccordion(
        "history",
        "History (all tasks)",
        filtered.length,
        html`<div class="mfilters">
            <label>Task<select data-mhist="task"><option value="">All tasks</option>${tasks.map((t) => html`<option value="${t.id}" ${ui.histTask === t.id ? html`selected` : ""}>${t.name}</option>`)}</select></label>
            <label>From<input type="date" data-mhist="from" value="${ui.histFrom}"></label>
            <label>To<input type="date" data-mhist="to" value="${ui.histTo}"></label>
            <span class="grow"></span>
            <button class="btn small flat" data-action="m-pdf" data-id="${obj.id}"><ha-icon icon="mdi:printer-outline"></ha-icon>Service record (PDF)</button>
          </div>
          ${filtered.length ? filtered.map((e) => this._mEventHtml(e, mb)) : html`<div class="empty sm">No entries in this range.</div>`}
          <div class="lastdone">${filtered.length} entries · Total cost: ${money(total, currency)}</div>`,
      )}`;
  }

  /* ---------------- Groceries: Mealie recipe browser ---------------- */

  _isGroceryPlan(plan) {
    return plan?.archetype === "shopping_errands" && (plan.settings?.role === "groceries" || !!plan.settings?.mealie_list_id);
  }

  _groceryPlan() {
    const plans = this._activePlans().filter((p) => this._isGroceryPlan(p));
    return plans.find((p) => p.settings?.role === "groceries") || plans[0] || null;
  }

  _shopTabsHtml(plan, mode) {
    if (!this._isGroceryPlan(plan)) return html``;
    const tab = (key, icon, label) =>
      html`<button class="tab ${mode === key ? "on" : ""}" data-action="r-shop-tab" data-plan="${plan.id}" data-id="${key}"><ha-icon icon="${icon}"></ha-icon>${label}</button>`;
    return html`<div class="msubnav rshoptabs">
      ${tab("list", "mdi:cart-outline", "Shopping list")}
      ${tab("recipes", "mdi:book-open-page-variant-outline", html`<span class="long">Browse Mealie </span>Recipes`)}
      ${tab("pantry", "mdi:shaker-outline", html`Pantry &amp; <span class="long">Excluded </span>Spices`)}
    </div>`;
  }

  async _loadRecipes(refresh = false) {
    if (this._recipeLoading) return;
    this._recipeLoading = true;
    this._recipes = { ...(this._recipes || {}), error: null };
    try {
      const data = await this._store.call({ type: "taskdragon/mealie_get_recipes", refresh });
      this._recipes = { data, error: null };
      this._importSettings = data.settings;
    } catch (err) {
      this._recipes = { ...(this._recipes || {}), error: err.message || String(err) };
    } finally {
      this._recipeLoading = false;
    }
    if (this._idx?.plans.get(this._currentTab())?.archetype === "shopping_errands") this._renderBody();
  }

  async _loadImportSettings() {
    if (this._settingsLoading) return;
    this._settingsLoading = true;
    this._settingsError = null;
    try {
      this._importSettings = await this._store.call({ type: "taskdragon/mealie_import_settings" });
    } catch (err) {
      this._settingsError = err.message || String(err);
    } finally {
      this._settingsLoading = false;
    }
    this._renderBody();
  }

  _filteredRecipes() {
    const all = this._recipes?.data?.recipes || [];
    const { category, sort, query } = this._ui.recipes;
    const q = query.trim().toLowerCase();
    let list = all;
    if (category.startsWith("c:")) list = list.filter((r) => r.categories.includes(category.slice(2)));
    else if (category.startsWith("t:")) list = list.filter((r) => r.tags.includes(category.slice(2)));
    if (q) list = list.filter((r) => [r.name, r.description, ...r.categories, ...r.tags].join(" ").toLowerCase().includes(q));
    const byName = (a, b) => a.name.localeCompare(b.name);
    const first = (r) => r.categories[0] || "~Uncategorized";
    const sorters = {
      az: byName,
      recent: (a, b) => String(b.date_added || "").localeCompare(String(a.date_added || "")) || byName(a, b),
      cooked: (a, b) => b.times_cooked - a.times_cooked || String(b.last_made || "").localeCompare(String(a.last_made || "")) || byName(a, b),
      category: (a, b) => first(a).localeCompare(first(b)) || byName(a, b),
    };
    return [...list].sort(sorters[sort] || byName);
  }

  _recipeCardHtml(plan, r) {
    const url = safeUrl(r.url);
    return html`<div class="rcard">
      <div class="rimg" data-action="c-open" data-slug="${r.slug}" data-name="${r.name}" title="Open the recipe" ${r.has_image ? html`data-rimg="${r.id}"` : ""}><ha-icon icon="mdi:silverware-fork-knife"></ha-icon></div>
      <div class="rbody">
        <button class="rtitle" data-action="c-open" data-slug="${r.slug}" data-name="${r.name}">${r.name}</button>
        <div class="rmeta">
          ${r.categories.slice(0, 3).map((c) => html`<span class="badge plan">${c}</span>`)}
          ${r.total_time ? html`<span class="badge"><ha-icon icon="mdi:timer-outline"></ha-icon>${r.total_time}</span>` : ""}
          ${r.times_cooked ? html`<span class="badge">Cooked ${r.times_cooked}×</span>` : ""}
          ${url ? html`<a class="badge" href="${url}"><ha-icon icon="mdi:open-in-new"></ha-icon>Mealie</a>` : ""}
        </div>
        <div class="ractions">
          <button class="btn small" data-action="r-add" data-plan="${plan.id}" data-slug="${r.slug}" title="Add the ingredients, skipping seasonings and what the pantry has"><ha-icon icon="mdi:cart-plus"></ha-icon>Add ingredients</button>
          <button class="btn small flat" data-action="r-review" data-plan="${plan.id}" data-slug="${r.slug}" data-name="${r.name}" title="Choose which ingredients to add"><ha-icon icon="mdi:format-list-checks"></ha-icon>Review</button>
          <button class="btn small flat" data-action="r-plan" data-plan="${plan.id}" data-slug="${r.slug}" data-name="${r.name}"><ha-icon icon="mdi:calendar-plus"></ha-icon>Plan meal</button>
        </div>
      </div>
    </div>`;
  }

  _recipesHtml(plan) {
    if (!this._board.mealie?.enabled) {
      return html`<div class="empty">Connect Mealie to browse recipes here: Settings → Devices &amp; services → TaskDragon → Configure → Mealie.</div>`;
    }
    const state = this._recipes;
    if (!state?.data) {
      if (state?.error) {
        return html`<div class="empty">Couldn't load recipes from Mealie: ${state.error} <button class="link" data-action="r-refresh">Try again</button></div>`;
      }
      this._loadRecipes();
      return html`<div class="empty">Loading recipes from Mealie…</div>`;
    }
    const ui = this._ui.recipes;
    const data = state.data;
    const list = this._filteredRecipes();
    const shown = list.slice(0, ui.limit || RECIPE_PAGE);
    const settings = this._importSettings || data.settings || {};
    const cards = [];
    let group = null;
    for (const r of shown) {
      if (ui.sort === "category") {
        const name = r.categories[0] || "Uncategorized";
        if (name !== group) cards.push(html`<div class="rgroup">${name}</div>`);
        group = name;
      }
      cards.push(this._recipeCardHtml(plan, r));
    }
    return html`<div class="rfilters">
        <input type="search" data-rsearch data-focus="rsearch" maxlength="100" value="${ui.query}" placeholder="Search ${data.recipes.length} recipes" aria-label="Search recipes">
        <select data-rfilter="category" aria-label="Category">
          <option value="">All categories</option>
          ${data.categories.length ? html`<optgroup label="Categories">${data.categories.map((c) => html`<option value="c:${c}" ${ui.category === `c:${c}` ? html`selected` : ""}>${c}</option>`)}</optgroup>` : ""}
          ${data.tags.length ? html`<optgroup label="Tags">${data.tags.map((t) => html`<option value="t:${t}" ${ui.category === `t:${t}` ? html`selected` : ""}>${t}</option>`)}</optgroup>` : ""}
        </select>
        <select data-rfilter="sort" aria-label="Sort">${RECIPE_SORTS.map(([v, l]) => html`<option value="${v}" ${ui.sort === v ? html`selected` : ""}>${l}</option>`)}</select>
        <button class="icon-btn" data-action="r-refresh" title="Reload recipes from Mealie" aria-label="Reload recipes"><ha-icon icon="mdi:refresh"></ha-icon></button>
      </div>
      <div class="rnote"><ha-icon icon="${settings.skip_seasonings ? "mdi:filter-check-outline" : "mdi:filter-off-outline"}"></ha-icon>
        ${settings.skip_seasonings ? "Add ingredients skips seasonings and anything the pantry has in stock." : "Add ingredients adds everything except what the pantry has in stock."}
        <button class="link" data-action="r-shop-tab" data-plan="${plan.id}" data-id="pantry">Change</button></div>
      ${list.length ? html`<div class="rgrid">${cards}</div>` : html`<div class="empty">${data.recipes.length ? "No recipes match." : "Mealie has no recipes yet."}</div>`}
      ${list.length > shown.length ? html`<div class="rmore"><button class="btn flat" data-action="r-more">Show more (${list.length - shown.length} left)</button></div>` : ""}`;
  }

  _pantryDrawerHtml(plan) {
    const settings = this._importSettings;
    if (!settings && this._settingsError) {
      return html`<div class="empty">Couldn't load the import settings: ${this._settingsError} <button class="link" data-action="r-settings-retry">Try again</button></div>`;
    }
    if (!settings) {
      this._loadImportSettings();
      return html`<div class="empty">Loading…</div>`;
    }
    const pantryPlans = this._activePlans().filter((p) => p.archetype === "pantry_spices");
    const items = this._board.pantry || [];
    const admin = this._isAdmin();
    return html`<div class="rsettings">
      ${pantryPlans.length
        ? html`<div class="mcard rscan"><h3><ha-icon icon="mdi:barcode-scan"></ha-icon>Putting groceries away?</h3>
            <div class="shop-add"><span class="grow lastdone">Scan each item: staples you already track flip to In Stock, new barcodes can be linked in one tap.</span>
              <button class="btn" data-action="s-open" data-context="pantry" data-plan="${pantryPlans[0].id}"><ha-icon icon="mdi:barcode-scan"></ha-icon>Scan</button></div></div>`
        : ""}
      <div class="mcard"><h3><ha-icon icon="mdi:filter-outline"></ha-icon>When adding a recipe to ${plan.name}</h3>
        <label class="inline rrow"><input type="checkbox" data-action="r-skip-toggle" ${settings.skip_seasonings ? html`checked` : ""} ${admin ? "" : html`disabled`}>
          <span class="grow">Automatically ignore seasonings &amp; spices when adding recipes</span></label>
        <div class="lastdone">Items the pantry has in stock are always skipped. In Review you can still re-check anything you're out of.${admin ? "" : " Only administrators can change this household setting."}</div>
      </div>
      <div class="mcard"><h3><ha-icon icon="mdi:shaker-outline"></ha-icon>Ignored seasonings &amp; staples <span class="badge">${settings.seasonings.length}</span><span class="grow"></span>
          ${admin ? html`<button class="link" data-action="r-seasoning-reset">Reset to defaults</button>` : ""}</h3>
        <div class="rchips">${settings.seasonings.map(
          (s) => html`<span class="chip">${s}${admin ? html`<button class="x" data-action="r-seasoning-remove" data-id="${s}" aria-label="Stop ignoring ${s}"><ha-icon icon="mdi:close"></ha-icon></button>` : ""}</span>`,
        )}</div>
        ${admin
          ? html`<div class="shop-add"><input data-seasoning-input maxlength="60" placeholder="Add a seasoning or staple… e.g. sesame oil" enterkeyhint="done" aria-label="Add an ignored seasoning">
              <button class="btn" data-action="r-seasoning-add" aria-label="Add"><ha-icon icon="mdi:plus"></ha-icon></button></div>`
          : ""}
        <div class="lastdone">Ingredients match by name, so "kosher salt" covers "1 tsp kosher salt, to taste". Mealie foods labelled as spices or seasonings are ignored too.</div>
      </div>
      ${pantryPlans.map((pp) => {
        const mine = items.filter((i) => i.plan_id === pp.id).sort((a, b) => a.name.localeCompare(b.name));
        return html`<div class="mcard"><h3><ha-icon icon="mdi:fridge-outline"></ha-icon>In the house now — ${pp.name}<span class="grow"></span><span class="badge">${mine.filter((i) => i.stock_state === "in_stock").length} in stock</span></h3>
          ${mine.length
            ? html`<div class="rpantry">${mine.map(
                (i) => html`<label><input type="checkbox" data-action="r-pantry-toggle" data-id="${i.id}" ${i.stock_state === "in_stock" ? html`checked` : ""}>${i.name}${i.stock_state === "low" ? html` <span class="badge today">low</span>` : ""}</label>`,
              )}</div>`
            : html`<div class="empty sm">No staples yet.</div>`}
          <div class="shop-add"><input data-pantry-input="${pp.id}" maxlength="120" placeholder="Add a staple you keep on hand… e.g. rice" enterkeyhint="done" aria-label="Add a pantry staple">
            <button class="btn" data-action="pantry-add" data-plan="${pp.id}" aria-label="Add"><ha-icon icon="mdi:plus"></ha-icon></button>
            <button class="btn flat" data-action="s-open" data-context="pantry" data-plan="${pp.id}" aria-label="Scan a barcode" title="Scan a barcode"><ha-icon icon="mdi:barcode-scan"></ha-icon>Scan</button></div>
        </div>`;
      })}
      ${pantryPlans.length ? "" : html`<div class="empty sm">Create a Pantry category to track the staples you keep in the house.</div>`}
    </div>`;
  }

  _recipeReviewHtml(d) {
    const p = d.preview;
    const reason = (row) =>
      row.skip === "seasoning" ? html`<span class="badge">Seasoning</span>` : row.skip === "pantry" ? html`<span class="badge ok">In pantry${row.pantry_item ? `: ${row.pantry_item}` : ""}</span>` : "";
    const checked = p ? p.ingredients.filter((r) => !r.skip).length : 0;
    return html`<h2><span class="grow">${d.name}</span>${this._closeButton()}</h2>
      <div class="hint">Checked items go on ${d.planName}. Seasonings and what the pantry has are unchecked; tick anything you're out of.</div>
      ${d.error ? html`<div class="empty">${d.error}</div>` : ""}
      ${p
        ? html`<div class="rreview">${p.ingredients.map(
            (row) => html`<label class="rrow ${row.skip ? "skip" : ""}"><input type="checkbox" data-ring="${row.index}" ${row.skip ? "" : html`checked`}>
              <span class="grow">${row.text}${row.note ? html` <span class="lastdone">(${row.note})</span>` : ""}</span>${reason(row)}</label>`,
          )}${p.ingredients.length ? "" : html`<div class="empty sm">This recipe has no ingredients in Mealie.</div>`}</div>`
        : d.error
          ? ""
          : html`<div class="empty sm">Loading ingredients…</div>`}
      <div class="dialog-actions">
        ${p ? html`<button class="btn flat" data-action="r-review-all">Check all</button>` : ""}<span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="r-review-save" ${p ? "" : html`disabled`}><ha-icon icon="mdi:cart-plus"></ha-icon>Add <span class="rcount">${checked}</span> to ${d.planName}</button>
      </div>`;
  }

  _recipePlanHtml(d) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(this._today(), i));
    const label = (iso, i) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${weekdayShort(iso)} ${monthDay(iso)}`);
    return html`<h2><span class="grow">Plan ${d.name}</span>${this._closeButton()}</h2>
      <div class="form rplan-form">
        <div class="full"><div class="rdays">${days.map(
          (iso, i) => html`<button type="button" class="chip ${d.day === iso ? "on" : ""}" data-action="r-plan-day" data-id="${iso}">${label(iso, i)}</button>`,
        )}</div></div>
        <label>…or another day<input type="date" name="r-day" value="${d.day}" min="${this._today()}"></label>
        <label>Meal<select name="r-meal">${MEAL_TYPES.map(([v, l]) => html`<option value="${v}" ${d.entry === v ? html`selected` : ""}>${l}</option>`)}</select></label>
        <label class="inline full"><input type="checkbox" name="r-also" ${d.add ? html`checked` : ""}>Also add its ingredients to ${d.planName} (skipping seasonings &amp; pantry items)</label>
      </div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="r-plan-save"><ha-icon icon="mdi:calendar-check"></ha-icon>Add to meal plan</button></div>`;
  }

  /** Recipe thumbnails: fetched with the user's token via HA, shown as blob URLs (lazily, as they scroll in). */
  _hydrateRecipeImages(container) {
    const slots = container.querySelectorAll("[data-rimg]");
    if (!this._rimg) this._rimg = new Map();
    if (this._rimgObserver) this._rimgObserver.disconnect();
    if (!slots.length) return;
    if (!this._rimgObserver && "IntersectionObserver" in window) {
      this._rimgObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this._rimgObserver.unobserve(entry.target);
            this._loadRecipeImage(entry.target.dataset.rimg);
          }
        },
        { rootMargin: "300px" },
      );
    }
    for (const slot of slots) {
      const id = slot.dataset.rimg;
      if (this._rimg.has(id)) this._showRecipeImage(slot, this._rimg.get(id));
      else if (this._rimgObserver) this._rimgObserver.observe(slot);
      else this._loadRecipeImage(id);
    }
  }

  async _loadRecipeImage(id) {
    if (!this._rimgPending) this._rimgPending = new Map();
    if (!this._rimg.has(id) && !this._rimgPending.has(id)) {
      const job = (async () => {
        try {
          const response = await this._hass.fetchWithAuth(`/api/taskdragon/mealie_image/${encodeURIComponent(id)}`);
          if (!response.ok) throw new Error(String(response.status));
          const blob = await response.blob();
          if (!/^image\/(webp|jpeg|png|gif)$/.test(blob.type)) throw new Error("not an image");
          this._rimg.set(id, URL.createObjectURL(blob));
        } catch (_err) {
          this._rimg.set(id, null); // keep the placeholder icon
        }
      })();
      this._rimgPending.set(id, job);
    }
    await this._rimgPending.get(id);
    this._rimgPending.delete(id);
    for (const slot of this.shadowRoot.querySelectorAll(`[data-rimg="${CSS.escape(id)}"]`)) this._showRecipeImage(slot, this._rimg.get(id));
  }

  _showRecipeImage(slot, url) {
    if (!url || slot.querySelector("img")) return;
    // Built with the DOM API: a blob: URL from our own fetch, never markup.
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.src = url;
    slot.replaceChildren(img);
  }

  async _saveImportSettings(changes) {
    try {
      this._importSettings = await this._store.call({ type: "taskdragon/mealie_import_settings", settings: changes });
      if (this._recipes?.data) this._recipes.data.settings = this._importSettings;
    } catch (err) {
      this._fail(err);
    }
    this._renderBody();
  }

  _seasoningAdd(input) {
    const value = (input || this.shadowRoot.querySelector("[data-seasoning-input]"))?.value.trim();
    if (!value || !this._importSettings) return;
    return this._saveImportSettings({ seasonings: [...this._importSettings.seasonings, value] });
  }

  _recipeResultToast(res) {
    const skipped = res.skipped_seasonings + res.skipped_pantry;
    const parts = [];
    if (res.added.length) parts.push(`Added ${res.added.length} item${res.added.length === 1 ? "" : "s"} from ${res.recipe}`);
    else if (!res.meal_plan) parts.push(`Nothing to add from ${res.recipe}`);
    if (res.meal_plan) parts.push(`${res.added.length ? "planned" : `Planned ${res.recipe}`} for ${weekdayShort(res.meal_plan.date)} ${usDate(res.meal_plan.date)}`);
    let message = parts.join(" · ");
    if (skipped) message += ` (Skipped ${skipped} seasoning${skipped === 1 ? "" : "s"}/pantry item${skipped === 1 ? "" : "s"})`;
    this._showToast(message);
  }

  _recipeChange(el) {
    const data = el.dataset || {};
    if (data.rfilter) {
      this._ui.recipes[data.rfilter] = el.value;
      this._ui.recipes.limit = RECIPE_PAGE;
      this._renderBody();
      return true;
    }
    if (data.ring !== undefined) {
      const count = this.shadowRoot.querySelectorAll(".rreview [data-ring]:checked").length;
      const label = this.shadowRoot.querySelector(".rcount");
      if (label) label.textContent = String(count);
      return true;
    }
    if (this._dialog?.kind === "recipe-plan" && el.name === "r-day") {
      this._dialog.day = el.value;
      this._syncPlanDraft();
      this._renderDialog();
      return true;
    }
    return false;
  }

  _syncPlanDraft() {
    const form = this.shadowRoot.querySelector(".rplan-form");
    const d = this._dialog;
    if (!form || d?.kind !== "recipe-plan") return;
    d.entry = form.querySelector('[name="r-meal"]').value;
    d.add = form.querySelector('[name="r-also"]').checked;
  }

  async _recipeAction(action, el, event) {
    const id = el.dataset.id;
    const ui = this._ui.recipes;
    const planName = (planId) => this._idx.plans.get(planId)?.name || "Groceries";
    switch (action) {
      case "r-open-browser": {
        const plan = this._groceryPlan();
        if (!plan) return this._showToast("Add a Groceries shopping category to browse recipes");
        this._ui.tab = plan.id;
        this._ui.shop[plan.id] = "recipes";
        return this._render();
      }
      case "r-shop-tab":
        this._ui.shop[el.dataset.plan] = id;
        return this._renderBody();
      case "r-refresh":
        this._recipes = null;
        this._renderBody();
        return this._loadRecipes(true);
      case "r-more":
        ui.limit = (ui.limit || RECIPE_PAGE) + RECIPE_PAGE;
        return this._renderBody();
      case "r-add": {
        el.disabled = true;
        try {
          const res = await this._call({ type: "taskdragon/mealie_add_recipe_to_groceries", recipe_slug: el.dataset.slug, plan_id: el.dataset.plan });
          this._recipeResultToast(res);
        } finally {
          el.disabled = false;
        }
        return;
      }
      case "r-review": {
        const dialog = { kind: "recipe-review", slug: el.dataset.slug, name: el.dataset.name, planId: el.dataset.plan, planName: planName(el.dataset.plan), preview: null, error: null };
        this._openDialog(dialog);
        try {
          dialog.preview = await this._store.call({ type: "taskdragon/mealie_recipe_preview", recipe_slug: dialog.slug });
        } catch (err) {
          dialog.error = err.message || String(err);
        }
        if (this._dialog === dialog) this._renderDialog();
        return;
      }
      case "r-review-all":
        for (const box of this.shadowRoot.querySelectorAll(".rreview [data-ring]")) box.checked = true;
        return this._recipeChange(this.shadowRoot.querySelector(".rreview [data-ring]") || el);
      case "r-review-save": {
        const d = this._dialog;
        const indices = [...this.shadowRoot.querySelectorAll(".rreview [data-ring]:checked")].map((box) => Number(box.dataset.ring));
        if (!indices.length) return this._showToast("Check at least one ingredient");
        const res = await this._call({ type: "taskdragon/mealie_add_recipe_to_groceries", recipe_slug: d.slug, plan_id: d.planId, ingredients: indices });
        this._closeDialog();
        return this._recipeResultToast(res);
      }
      case "r-plan":
        return this._openDialog({ kind: "recipe-plan", slug: el.dataset.slug, name: el.dataset.name, planId: el.dataset.plan, planName: planName(el.dataset.plan), day: this._today(), entry: "dinner", add: true });
      case "r-plan-day":
        this._syncPlanDraft();
        this._dialog.day = id;
        return this._renderDialog();
      case "r-plan-save": {
        this._syncPlanDraft();
        const d = this._dialog;
        if (!d.day) return this._showToast("Pick a day");
        const res = await this._call({
          type: "taskdragon/mealie_plan_meal",
          recipe_slug: d.slug,
          date: d.day,
          entry_type: d.entry,
          add_ingredients: d.add,
          plan_id: d.planId,
        });
        this._closeDialog();
        return this._recipeResultToast(res);
      }
      case "r-settings-retry":
        this._settingsError = null;
        return this._loadImportSettings();
      case "r-skip-toggle":
        return this._saveImportSettings({ skip_seasonings: el.checked });
      case "r-seasoning-remove":
        return this._saveImportSettings({ seasonings: (this._importSettings?.seasonings || []).filter((s) => s !== id) });
      case "r-seasoning-add":
        return this._seasoningAdd();
      case "r-seasoning-reset":
        if (!confirm("Replace the ignored list with the built-in seasonings and staples?")) return;
        return this._saveImportSettings({ seasonings: this._importSettings?.defaults || [] });
      case "r-pantry-toggle":
        return this._pantryState(id, el.checked ? "in_stock" : "out");
      default:
        return;
    }
  }

  /* ---------------- Barcode scanner ---------------- */

  /** Open the camera viewfinder. ``context``: pantry | maintenance | hoard (price check) | auto (header button). */
  async _scanOpen(context, extra = {}) {
    if (this._scan) return;
    const scan = { context, objectId: extra.objectId || null, planId: extra.planId || null, itemId: extra.itemId || null, status: "Starting the camera…", warn: false, torch: false, devices: [], deviceId: null, stream: null, track: null, engine: null, busy: false, last: null, done: false, timer: null, video: null };
    this._scan = scan;
    if (!this._onScanHidden) {
      // A phone that locks or switches apps must give the camera back.
      this._onScanHidden = () => {
        if (document.visibilityState === "hidden" && this._scan) this._scanStop();
      };
      document.addEventListener("visibilitychange", this._onScanHidden);
    }
    this._renderScanner();
    await this._scanStart(scan);
  }

  _renderScanner() {
    const host = this.shadowRoot.querySelector(".td-scan-host");
    const scan = this._scan;
    if (!host) return;
    if (!scan) {
      setHTML(host, html``);
      return;
    }
    const where = scan.context === "pantry" ? "Scan a pantry item" : scan.context === "maintenance" ? "Scan a part or consumable" : scan.context === "hoard" ? "Scan to compare prices" : "Scan a barcode";
    setHTML(
      host,
      html`<div class="td-scan" role="dialog" aria-modal="true" aria-label="${where}">
        <div class="sviewport"></div>
        <div class="reticle" aria-hidden="true"></div>
        <div class="sbar">
          <button class="sbtn" data-action="s-close" aria-label="Close the scanner"><ha-icon icon="mdi:close"></ha-icon></button>
          <span class="grow">${where}</span>
          <button class="sbtn" data-action="s-torch" aria-label="Flashlight" title="Flashlight" hidden><ha-icon icon="mdi:flashlight"></ha-icon></button>
          <button class="sbtn" data-action="s-switch" aria-label="Switch camera" title="Switch camera" hidden><ha-icon icon="mdi:camera-flip-outline"></ha-icon></button>
        </div>
        <div class="sbottom">
          <div class="sstatus" aria-live="polite"></div>
          <div class="smanual"><input data-scan-manual inputmode="text" autocomplete="off" maxlength="256" placeholder="…or type the barcode number" enterkeyhint="go" aria-label="Barcode number">
            <button data-action="s-manual">Look up</button></div>
          <div class="sengine"></div>
        </div>
      </div>`,
    );
    // The live camera feed is a DOM-built element, never markup.
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.muted = true;
    video.autoplay = true;
    host.querySelector(".sviewport").replaceChildren(video);
    scan.video = video;
    this._scanControls();
  }

  _scanControls() {
    const scan = this._scan;
    const root = this.shadowRoot.querySelector(".td-scan");
    if (!scan || !root) return;
    const status = root.querySelector(".sstatus");
    status.textContent = scan.status;
    status.classList.toggle("warn", !!scan.warn);
    const torch = root.querySelector('[data-action="s-torch"]');
    torch.hidden = !scan.torchSupported;
    torch.classList.toggle("on", !!scan.torch);
    torch.setAttribute("aria-pressed", scan.torch ? "true" : "false");
    root.querySelector('[data-action="s-switch"]').hidden = scan.devices.length < 2;
    root.querySelector(".sengine").textContent = scan.engine ? (scan.engine.kind === "native" ? "Using the built-in barcode reader" : "Using the bundled ZXing reader") : "";
  }

  _scanStatus(message, warn = false) {
    if (!this._scan) return;
    this._scan.status = message;
    this._scan.warn = warn;
    this._scanControls();
  }

  async _scanStart(scan) {
    if (!navigator.mediaDevices?.getUserMedia) {
      this._scanStatus(
        window.isSecureContext ? "This browser can't use the camera. Type the barcode number below." : "The camera needs Home Assistant over HTTPS (or the Companion app). Type the barcode number below.",
        true,
      );
      return;
    }
    const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
    const video = scan.deviceId ? { deviceId: { exact: scan.deviceId }, ...size } : { facingMode: { ideal: "environment" }, ...size };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      if (this._scan !== scan || scan.done) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      scan.stream = stream;
      scan.video.srcObject = stream;
      await scan.video.play().catch(() => {});
      scan.track = stream.getVideoTracks()[0] || null;
      const caps = scan.track?.getCapabilities?.() || {};
      scan.torchSupported = !!caps.torch;
      scan.torch = false;
      try {
        scan.devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      } catch (_err) {
        scan.devices = [];
      }
      const reported = scan.track?.getSettings?.().deviceId;
      if (reported && scan.devices.some((d) => d.deviceId === reported)) scan.deviceId = reported;
      if (!scan.engine) scan.engine = await this._scanEngine();
      if (this._scan !== scan) return;
      this._scanStatus(scan.engine ? "Hold the barcode inside the frame" : "Barcode reading isn't available in this browser. Type the number below.", !scan.engine);
      if (scan.engine) this._scanLoop(scan);
    } catch (err) {
      const blocked = err?.name === "NotAllowedError" || err?.name === "SecurityError";
      const missing = err?.name === "NotFoundError" || err?.name === "OverconstrainedError";
      this._scanStatus(
        blocked
          ? "Camera access was blocked. Allow it in the browser or Companion app settings, or type the number below."
          : missing
            ? "No camera was found. Type the barcode number below."
            : `The camera didn't start (${err?.name || err}). Type the barcode number below.`,
        true,
      );
    }
  }

  /** The browser's BarcodeDetector when it can read our formats, otherwise the bundled ZXing reader. */
  async _scanEngine() {
    if ("BarcodeDetector" in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const formats = SCAN_FORMATS.filter((f) => supported.includes(f));
        if (formats.length) {
          const detector = new window.BarcodeDetector({ formats });
          return {
            kind: "native",
            detect: async (video) => {
              const codes = await detector.detect(video);
              return codes.length ? { text: codes[0].rawValue, format: codes[0].format } : null;
            },
          };
        }
      } catch (_err) {
        /* fall back to ZXing */
      }
    }
    let ZX;
    try {
      ZX = await loadZXing();
    } catch (_err) {
      return null;
    }
    const hints = new Map();
    hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, Object.values(ZXING_FORMATS).map((name) => ZX.BarcodeFormat[name]));
    hints.set(ZX.DecodeHintType.TRY_HARDER, true);
    const reader = new ZX.MultiFormatReader();
    reader.setHints(hints);
    const names = Object.fromEntries(Object.entries(ZXING_FORMATS).map(([ours, theirs]) => [ZX.BarcodeFormat[theirs], ours]));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return {
      kind: "zxing",
      detect: async (video) => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return null;
        // Only the middle of the frame (where the reticle is): faster and fewer stray reads.
        const cw = Math.round(w * 0.8);
        const ch = Math.round(h * 0.6);
        canvas.width = cw;
        canvas.height = ch;
        ctx.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
        try {
          const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.HTMLCanvasElementLuminanceSource(canvas)));
          const result = reader.decodeWithState(bitmap);
          return { text: result.getText(), format: names[result.getBarcodeFormat()] || "unknown" };
        } catch (_err) {
          return null; // nothing readable in this frame
        } finally {
          reader.reset();
        }
      },
    };
  }

  _scanLoop(scan) {
    const tick = async () => {
      if (this._scan !== scan || scan.done) return;
      if (!scan.busy && scan.video?.readyState >= 2) {
        scan.busy = true;
        try {
          const hit = await scan.engine.detect(scan.video);
          if (hit?.text && this._scan === scan && !scan.done) {
            // ZXing reads one frame at a time; a 1D code must read the same twice before it counts.
            if (scan.engine.kind === "native" || hit.format === "qr_code" || scan.last === hit.text) return void this._scanFound(scan, hit);
            scan.last = hit.text;
          }
        } catch (_err) {
          /* a frame that fails to decode is normal */
        } finally {
          scan.busy = false;
        }
      }
      if (this._scan === scan && !scan.done) scan.timer = setTimeout(tick, scan.engine.kind === "native" ? 120 : 160);
    };
    tick();
  }

  async _scanFound(scan, hit) {
    if (scan.done) return;
    scan.done = true;
    this.shadowRoot.querySelector(".td-scan")?.classList.add("hit");
    try {
      if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(50);
    } catch (_err) {
      /* no vibration motor */
    }
    const context = { context: scan.context, objectId: scan.objectId, planId: scan.planId, itemId: scan.itemId };
    this._scanStop();
    await this._scanLookup(hit.text, hit.format, context);
  }

  _scanStop() {
    const scan = this._scan;
    if (scan) {
      scan.done = true;
      clearTimeout(scan.timer);
      if (scan.stream) scan.stream.getTracks().forEach((t) => t.stop());
      if (scan.video) {
        scan.video.pause?.();
        scan.video.srcObject = null;
      }
    }
    this._scan = null;
    if (this._onScanHidden) {
      document.removeEventListener("visibilitychange", this._onScanHidden);
      this._onScanHidden = null;
    }
    const host = this.shadowRoot?.querySelector(".td-scan-host");
    if (host) setHTML(host, html``);
  }

  async _scanTorch() {
    const scan = this._scan;
    if (!scan?.track) return;
    const on = !scan.torch;
    try {
      await scan.track.applyConstraints({ advanced: [{ torch: on }] });
      scan.torch = on;
    } catch (_err) {
      this._scanStatus("The flashlight isn't available on this camera", true);
    }
    this._scanControls();
  }

  async _scanSwitch() {
    const scan = this._scan;
    if (!scan || scan.devices.length < 2) return;
    const found = scan.devices.findIndex((d) => d.deviceId === scan.deviceId);
    const next = ((found >= 0 ? found : scan.deviceIndex ?? -1) + 1) % scan.devices.length;
    scan.deviceIndex = next;
    scan.deviceId = scan.devices[next].deviceId;
    clearTimeout(scan.timer);
    if (scan.stream) scan.stream.getTracks().forEach((t) => t.stop());
    scan.stream = null;
    scan.last = null;
    this._scanStatus("Switching camera…");
    await this._scanStart(scan);
  }

  _scanManual() {
    const scan = this._scan;
    const value = this.shadowRoot.querySelector("[data-scan-manual]")?.value.trim();
    if (!scan || !value) return;
    return this._scanFound(scan, { text: value, format: null });
  }

  /** What the code is linked to; pantry staples are marked In Stock right away. */
  async _scanLookup(code, format, ctx) {
    // On a wishlist (or from its scan button) a barcode is an in-store price check.
    if (ctx.context === "hoard" || (ctx.context === "auto" && this._hPlanId())) return this._hScanLookup(code, format, { ...ctx, planId: ctx.planId || this._hPlanId() });
    let res;
    try {
      const message = { type: "taskdragon/barcode_lookup", barcode: code, context: ctx.context, apply_default: true };
      if (format && SCAN_FORMATS.includes(format)) message.format = format;
      res = await this._store.call(message);
    } catch (err) {
      return this._fail(err);
    }
    if (res.match?.target_type === "pantry_item") return this._scanPantryToast(res);
    if (res.match?.target_type === "maintenance_part") return this._openDialog({ kind: "scan-part", res, restock: false });
    const options = res.options || {};
    const type = ctx.context === "pantry" ? "pantry_item" : ctx.context === "maintenance" ? "maintenance_part" : options.suggested_part_id && !options.suggested_pantry_id ? "maintenance_part" : "pantry_item";
    const suggestion = res.suggestion;
    return this._openDialog({
      kind: "scan-link",
      res,
      type,
      mode: "pick",
      query: "",
      selected: { pantry_item: options.suggested_pantry_id || null, maintenance_part: options.suggested_part_id || null },
      name: suggestion?.title || "",
      planId: ctx.planId || options.pantry_plans?.[0]?.id || "",
      objectId: ctx.objectId || "",
      stock: "",
      reorder: "",
      delta: 1,
      busy: false,
    });
  }

  _scanPantryToast(res) {
    const item = res.match.item;
    const applied = res.applied;
    const code = res.barcode;
    const message = res.created
      ? `Added ${item.name} to the pantry as In Stock — Mealie recipe imports will skip it`
      : applied && applied.previous !== "in_stock"
        ? `Marked ${item.name} as In Stock — Mealie recipe imports will skip it`
        : `${item.name} is already in stock — recipe imports skip it`;
    const set = (status, lowAction, label) => ({
      label,
      run: async () => {
        const out = await this._call({ type: "taskdragon/barcode_apply_action", barcode: code, action: "set_pantry_status", status, low_action: lowAction });
        if (out.action_needed) return this._openDialog({ kind: "pantry-low", item: { ...out.match.item, ingredients: [] }, state: status });
        const added = (out.created || []).find((c) => c.type === "shopping");
        this._showToast(
          status === "low" ? `${item.name} marked low` : added ? `${item.name} is out — added to ${this._idx.plans.get(added.plan_id)?.name || "the list"}` : `${item.name} marked out`,
          this._undoWith(out.undo),
        );
      },
    });
    this._showToast(message, applied?.undo ? this._undoWith(applied.undo) : null, [set("low", null, "Mark low"), set("out", "shopping", "Out + add to list")]);
  }

  /* -------- scan result: part sheet -------- */

  _scanPartHtml(d) {
    const m = d.res.match;
    const p = m.part;
    const delta = m.default_delta_qty || 1;
    const object = p.object_name ? `${p.object_name}${p.object_number ? ` (#${p.object_number})` : ""}` : "Not linked to an object";
    return html`<div class="ssheet-head"><span class="sicon"><ha-icon icon="mdi:package-variant-closed"></ha-icon></span>
        <div class="grow"><h2>${p.part_name}</h2><div class="lastdone">${p.plan_name || ""}</div></div>${this._closeButton()}</div>
      <div class="sstock"><span>Current stock: <strong class="${p.low ? "low" : ""}">${p.current_stock}</strong></span>
        <span>Linked object: <strong>${object}</strong></span><span>Reorder at ${p.reorder_threshold}</span>
        ${p.storage_location ? html`<span>${p.storage_location}</span>` : ""}</div>
      <div class="sactions">
        <button class="btn sbig" data-action="s-use" autofocus><ha-icon icon="mdi:minus-circle-outline"></ha-icon>−${delta} Use part</button>
        <button class="btn flat" data-action="s-restock-open" aria-expanded="${d.restock ? "true" : "false"}"><ha-icon icon="mdi:plus-circle-outline"></ha-icon>Restock</button>
      </div>
      ${d.restock
        ? html`<div class="spills" role="group" aria-label="How many did you add?">
            ${RESTOCK_PILLS.map((n) => html`<button class="chip" data-action="s-restock" data-id="${n}">+${n}</button>`)}
            <input type="number" min="1" max="10000" step="1" inputmode="numeric" data-scan-qty placeholder="Other" aria-label="Other amount">
            <button class="btn small" data-action="s-restock-custom">Add</button></div>`
        : ""}
      <div class="scode"><ha-icon icon="mdi:barcode"></ha-icon><code>${d.res.display}</code>${m.mapped ? html`<button class="link" data-action="s-unlink">Unlink this barcode</button>` : html`<span>matched by the part's MPN/GTIN</span>`}</div>`;
  }

  async _scanApplyPart(action, quantity) {
    const d = this._dialog;
    if (d?.kind !== "scan-part") return;
    const message = { type: "taskdragon/barcode_apply_action", barcode: d.res.barcode, action };
    if (quantity) message.quantity = quantity;
    const res = await this._call(message);
    this._closeDialog();
    const p = res.match.part;
    let text = action === "use_one" ? `Used ${res.quantity} × ${p.part_name} — ${p.current_stock} left` : `Restocked ${res.quantity} × ${p.part_name} — ${p.current_stock} in stock`;
    if (res.reorder) text += ` · added to ${this._idx.plans.get(res.reorder.plan_id)?.name || "the shopping list"}`;
    if (res.closed) text += ` · checked off ${res.closed.summary}`;
    this._showToast(text, this._undoWith(res.undo));
    this._mRefresh?.();
  }

  /* -------- scan result: link an unknown barcode -------- */

  _scanLinkOptions(d) {
    const options = d.res.options || {};
    const q = d.query.trim().toLowerCase();
    const list =
      d.type === "pantry_item"
        ? (options.pantry || []).map((i) => ({ id: i.id, name: i.name, sub: [i.plan_name, i.category, i.stock_state.replace("_", " ")].filter(Boolean).join(" · ") }))
        : (options.parts || []).map((p) => ({ id: p.id, name: p.part_name, sub: [p.object_name, `${p.current_stock} in stock`, p.storage_location].filter(Boolean).join(" · ") }));
    return q ? list.filter((o) => `${o.name} ${o.sub}`.toLowerCase().includes(q)) : list;
  }

  _scanLinkListHtml(d) {
    const options = this._scanLinkOptions(d);
    const suggested = d.type === "pantry_item" ? d.res.options?.suggested_pantry_id : d.res.options?.suggested_part_id;
    const chosen = d.selected[d.type];
    if (!options.length) return html`<div class="empty sm">${d.query ? "Nothing matches." : d.type === "pantry_item" ? "No pantry items yet — create one." : "No parts yet — create one."}</div>`;
    return html`${options.slice(0, 200).map(
      (o) => html`<label class="slink-row ${chosen === o.id ? "on" : ""}"><input type="radio" name="slink-pick" data-slink-pick="${o.id}" ${chosen === o.id ? html`checked` : ""}>
        <span class="grow"><strong>${o.name}</strong>${o.id === suggested ? html` <span class="badge ok">Suggested</span>` : ""}<div class="lastdone">${o.sub}</div></span></label>`,
    )}`;
  }

  _scanLinkHtml(d) {
    const res = d.res;
    const options = res.options || {};
    const s = res.suggestion;
    const lookupNote = {
      not_found: "Open Food Facts doesn't know this code.",
      error: "Open Food Facts couldn't be reached.",
      disabled: "Product lookups are off (Settings).",
      not_retail: "",
    }[res.lookup];
    const isPantry = d.type === "pantry_item";
    const pickable = this._scanLinkOptions({ ...d, query: "" }).length;
    return html`<h2><span class="grow">Link barcode <code>${res.display}</code></span>${this._closeButton()}</h2>
      ${s
        ? html`<div class="slink-suggest"><ha-icon icon="mdi:food-variant"></ha-icon><span class="grow"><strong>${s.name}</strong>
            <div class="lastdone">${[s.brand, s.quantity, "from Open Food Facts"].filter(Boolean).join(" · ")}</div></span></div>`
        : lookupNote
          ? html`<div class="hint">${lookupNote}</div>`
          : ""}
      <div class="seg slink-type" role="group" aria-label="Link to">
        <button class="${isPantry ? "on" : ""}" data-action="s-link-type" data-id="pantry_item"><ha-icon icon="mdi:shaker-outline"></ha-icon>Pantry item</button>
        <button class="${isPantry ? "" : "on"}" data-action="s-link-type" data-id="maintenance_part"><ha-icon icon="mdi:package-variant-closed"></ha-icon>Maintenance part</button>
      </div>
      <div class="msubnav" style="margin-top:10px">
        <button class="tab ${d.mode === "pick" ? "on" : ""}" data-action="s-link-mode" data-id="pick">Pick existing${pickable ? html` <span class="badge">${pickable}</span>` : ""}</button>
        <button class="tab ${d.mode === "create" ? "on" : ""}" data-action="s-link-mode" data-id="create">Create new</button>
      </div>
      ${d.mode === "pick"
        ? html`<input type="search" class="slink-search" data-slink-search data-focus="slink-search" value="${d.query}" maxlength="80" placeholder="Search ${isPantry ? "pantry items" : "parts"}…" aria-label="Search">
            <div class="slink-list">${this._scanLinkListHtml(d)}</div>`
        : html`<div class="form slink-form">
            <label class="full">Name<input name="s-name" value="${d.name}" maxlength="120" placeholder="${isPantry ? "e.g. Peanut butter" : "e.g. Furnace filter 16x25x4"}" autofocus></label>
            ${isPantry
              ? (options.pantry_plans || []).length > 1
                ? html`<label>Pantry<select name="s-plan">${options.pantry_plans.map((p) => html`<option value="${p.id}" ${d.planId === p.id ? html`selected` : ""}>${p.name}</option>`)}</select></label>`
                : ""
              : html`<label>Object<select name="s-object"><option value="">No object</option>${(options.objects || []).map(
                    (o) => html`<option value="${o.id}" ${d.objectId === o.id ? html`selected` : ""}>${o.name} (#${o.number})</option>`,
                  )}</select></label>
                <label>In stock now<input name="s-stock" type="number" min="0" step="1" inputmode="numeric" value="${d.stock}" placeholder="0"></label>
                <label>Reorder at<input name="s-reorder" type="number" min="0" step="1" inputmode="numeric" value="${d.reorder}" placeholder="0"></label>`}
          </div>`}
      ${isPantry ? "" : html`<label class="inline" style="margin-top:10px">Each scan uses <input name="s-delta" type="number" min="1" max="1000" step="1" value="${d.delta}" style="width:72px"> item(s)</label>`}
      <div class="dialog-actions"><span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="s-link-save" ${d.busy ? html`disabled` : ""}><ha-icon icon="mdi:link-variant"></ha-icon>${isPantry ? "Link & mark in stock" : "Link barcode"}</button>
      </div>`;
  }

  _scanSyncLink() {
    const d = this._dialog;
    if (d?.kind !== "scan-link") return;
    const value = (name) => this.shadowRoot.querySelector(`.dialog [name="${name}"]`)?.value;
    if (value("s-name") !== undefined) d.name = value("s-name");
    if (value("s-plan") !== undefined) d.planId = value("s-plan");
    if (value("s-object") !== undefined) d.objectId = value("s-object");
    if (value("s-stock") !== undefined) d.stock = value("s-stock");
    if (value("s-reorder") !== undefined) d.reorder = value("s-reorder");
    if (value("s-delta") !== undefined) d.delta = Math.max(1, Math.min(1000, Number(value("s-delta")) || 1));
  }

  async _scanLinkSave() {
    this._scanSyncLink();
    const d = this._dialog;
    if (d?.kind !== "scan-link" || d.busy) return;
    const message = { type: "taskdragon/barcode_bind", barcode: d.res.barcode, target_type: d.type, default_delta_qty: d.delta, apply_default: true };
    if (d.res.symbology && SCAN_FORMATS.includes(d.res.symbology)) message.format = d.res.symbology;
    if (d.res.suggestion) {
      message.product_name = d.res.suggestion.name || null;
      message.brand = d.res.suggestion.brand || null;
    }
    if (d.mode === "pick") {
      const chosen = d.selected[d.type];
      if (!chosen) return this._showToast(`Pick a ${d.type === "pantry_item" ? "pantry item" : "part"}, or create a new one`);
      message.target_id = chosen;
    } else {
      const name = d.name.trim();
      if (!name) return this._showToast("Give it a name");
      const create = { name };
      if (d.type === "pantry_item") {
        if (d.planId) create.plan_id = d.planId;
      } else {
        if (d.objectId) create.object_id = d.objectId;
        if (d.stock !== "") create.current_stock = Number(d.stock);
        if (d.reorder !== "") create.reorder_threshold = Number(d.reorder);
      }
      message.create = create;
    }
    d.busy = true;
    this._renderDialog();
    let res;
    try {
      res = await this._call(message);
    } catch (_err) {
      d.busy = false;
      if (this._dialog === d) this._renderDialog();
      return;
    }
    this._closeDialog();
    const name = (res.match.item || {}).name || (res.match.part || {}).part_name;
    const replaced = res.replaced ? ` (was ${res.replaced.name})` : "";
    if (res.match.target_type === "pantry_item") {
      this._scanPantryToast({ ...res, barcode: d.res.barcode, applied: res.applied });
      return;
    }
    this._showToast(`Linked ${d.res.display} to ${name}${replaced}`);
    this._openDialog({ kind: "scan-part", res: { ...d.res, match: res.match }, restock: false });
    this._mRefresh?.();
  }

  async _scanAction(action, el) {
    const d = this._dialog;
    switch (action) {
      case "s-open":
        return this._scanOpen(el.dataset.context || "auto", { objectId: el.dataset.object, planId: el.dataset.plan });
      case "s-close":
        return this._scanStop();
      case "s-torch":
        return this._scanTorch();
      case "s-switch":
        return this._scanSwitch();
      case "s-manual":
        return this._scanManual();
      case "s-use":
        return this._scanApplyPart("use_one");
      case "s-restock-open":
        d.restock = !d.restock;
        this._renderDialog();
        return void setTimeout(() => this.shadowRoot.querySelector("[data-scan-qty]")?.focus(), 40);
      case "s-restock":
        return this._scanApplyPart("restock_qty", Number(el.dataset.id));
      case "s-restock-custom": {
        const qty = Number(this.shadowRoot.querySelector("[data-scan-qty]")?.value);
        if (!(qty > 0)) return this._showToast("Enter how many you added");
        return this._scanApplyPart("restock_qty", qty);
      }
      case "s-unlink": {
        if (!confirm(`Unlink ${d.res.display} from ${d.res.match.part.part_name}?`)) return;
        await this._call({ type: "taskdragon/barcode_unbind", barcode: d.res.barcode });
        this._closeDialog();
        return this._showToast("Barcode unlinked");
      }
      case "s-link-type":
        this._scanSyncLink();
        d.type = el.dataset.id;
        d.query = "";
        return this._renderDialog();
      case "s-link-mode":
        this._scanSyncLink();
        d.mode = el.dataset.id;
        return this._renderDialog();
      case "s-link-save":
        return this._scanLinkSave();
      default:
        return;
    }
  }

  /* ---------------- Cooking view (recipe detail) ---------------- */

  _keepAwakeDefault() {
    return storage.get(KEEP_AWAKE_KEY, "0") === "1";
  }

  async _cookOpen(slug, name) {
    if (!slug) return;
    const d = { kind: "cook", slug, name: name || "Recipe", detail: null, error: null, scale: 1, got: new Set(), done: new Set(), awake: this._keepAwakeDefault(), awakeStatus: null };
    this._openDialog(d);
    if (d.awake) this._wakeOn(d);
    try {
      d.detail = await this._store.call({ type: "taskdragon/mealie_get_recipe_detail", recipe_slug: slug });
      d.name = d.detail.name;
    } catch (err) {
      d.error = err.message || String(err);
    }
    if (this._dialog === d) this._renderDialog();
  }

  _cookYield(d) {
    const r = d.detail;
    if (r.servings) return `${fmtAmount(r.servings * d.scale, false)} serving${r.servings * d.scale === 1 ? "" : "s"}`;
    if (r.yield) return d.scale === 1 ? r.yield : `${r.yield} × ${fmtAmount(d.scale)}`;
    return null;
  }

  _cookIngredientsHtml(d) {
    const r = d.detail;
    const rows = r.ingredients;
    const missing = rows.filter((row) => row.type === "ingredient" && !row.skip).length;
    const plan = this._groceryPlan();
    const items = rows.map((row) => {
      if (row.type === "section") return html`<div class="csection">${row.title}</div>`;
      const { amount, rest } = scaledIngredient(row, d.scale);
      const got = d.got.has(row.index);
      return html`<label class="cing ${got ? "got" : ""}"><input type="checkbox" data-action="c-ing" data-index="${row.index}" ${got ? html`checked` : ""}>
        <span class="grow">${amount ? html`<span class="amt">${amount}</span> ` : ""}${rest}
          ${row.in_pantry ? html`<span class="badge ok" title="${row.pantry_item ? `In stock: ${row.pantry_item}` : "In stock"}">In pantry</span>` : row.is_excluded_spice ? html`<span class="badge ok">Seasoning</span>` : ""}</span></label>`;
    });
    return html`<h3><ha-icon icon="mdi:format-list-bulleted"></ha-icon>Ingredients <span class="badge">${r.counts.ingredients}</span></h3>
      ${plan
        ? html`<button class="btn caddmissing" data-action="c-add-missing" ${missing ? "" : html`disabled`}><ha-icon icon="mdi:cart-plus"></ha-icon>Add missing ingredients to ${plan.name} (${missing})</button>`
        : ""}
      ${items.length ? items : html`<div class="empty sm">No ingredients in Mealie.</div>`}`;
  }

  _cookStepClasses(d, index) {
    const r = d.detail;
    const current = r.instructions.find((s) => !d.done.has(s.index));
    return `cstep${d.done.has(index) ? " done" : ""}${current && current.index === index ? " current" : ""}`;
  }

  _cookAwakeText(d) {
    return { on: "Screen awake", paused: "Waiting to keep the screen on…", unsupported: "This browser can't keep the screen on", blocked: "The browser blocked keep-awake" }[d.awakeStatus] || "";
  }

  _cookHtml(d) {
    const head = html`<div class="cook-head">
        <button class="icon-btn" data-action="dialog-close" aria-label="Close recipe"><ha-icon icon="mdi:arrow-left"></ha-icon></button>
        <span class="ctitle">${d.name}</span>
        <label class="cawake ${d.awake ? "on" : ""}"><input type="checkbox" data-action="c-awake" ${d.awake ? html`checked` : ""}><ha-icon class="sun" icon="mdi:white-balance-sunny"></ha-icon>Keep screen on while viewing</label>
        <span class="cawake-status ${d.awakeStatus === "on" ? "on" : ""}" data-cook-awake aria-live="polite">${d.awake ? this._cookAwakeText(d) : ""}</span>
      </div>`;
    if (!d.detail) {
      return html`${head}<div class="cook-scroll"><div class="empty">${d.error ? `Couldn't load the recipe: ${d.error}` : "Loading the recipe…"}</div></div>`;
    }
    const r = d.detail;
    const url = safeUrl(r.url);
    const source = safeUrl(r.source_url);
    const time = (label, value) => (value ? html`<div>${label}<strong>${value}</strong></div>` : "");
    const yieldText = this._cookYield(d);
    const steps = r.instructions.map(
      (s, i) => html`<div class="${this._cookStepClasses(d, s.index)}" data-action="c-step" data-index="${s.index}" role="button" tabindex="0" aria-pressed="${d.done.has(s.index) ? "true" : "false"}">
        <span class="cnum">${d.done.has(s.index) ? "✓" : i + 1}</span>
        <div class="ctext">${s.title ? html`<strong>${s.title}</strong>` : ""}${s.text}
          ${s.timers.length
            ? html`<div class="ctimer-pills">${s.timers.map(
                (t) => html`<button class="ctimer-pill" data-action="c-timer" data-seconds="${t.seconds}" data-label="${`Step ${i + 1}: ${t.label}`}"><ha-icon icon="mdi:timer-outline"></ha-icon>Start ${t.label} timer</button>`,
              )}</div>`
            : ""}</div>
      </div>`,
    );
    return html`${head}
      <div class="cook-scroll">
        <div class="cook-hero">
          <div class="cook-img" ${r.has_image && r.image_url ? html`data-cookimg="${r.id}"` : ""}><ha-icon icon="mdi:silverware-fork-knife"></ha-icon></div>
          <div class="cmeta">
            <h2>${r.name}</h2>
            ${r.description ? html`<p class="cdesc">${r.description}</p>` : ""}
            <div class="rmeta">${r.categories.map((c) => html`<span class="badge plan">${c}</span>`)}${r.tags.map((t) => html`<span class="badge">#${t}</span>`)}</div>
            <div class="ctimes">${time("Prep", r.prep_time)}${time("Cook", r.cook_time)}${time("Total", r.total_time)}${yieldText ? html`<div>Makes<strong data-cook-yield>${yieldText}</strong></div>` : ""}</div>
            <div class="cscale" role="group" aria-label="Batch size">${COOK_SCALES.map(
              (s) => html`<button class="chip ${d.scale === s ? "on" : ""}" data-action="c-scale" data-id="${s}" aria-pressed="${d.scale === s ? "true" : "false"}">${fmtAmount(s)}×</button>`,
            )}</div>
            <div class="rmeta">${url ? html`<a class="badge" href="${url}"><ha-icon icon="mdi:open-in-new"></ha-icon>Open in Mealie</a>` : ""}${source ? html`<a class="badge" href="${source}"><ha-icon icon="mdi:web"></ha-icon>Original recipe</a>` : ""}</div>
          </div>
        </div>
        <div class="cook-cols">
          <section class="cook-ings">${this._cookIngredientsHtml(d)}</section>
          <section class="cook-steps"><h3><ha-icon icon="mdi:chef-hat"></ha-icon>Instructions <span class="lastdone">tap a step when it's done</span></h3>
            ${steps.length ? steps : html`<div class="empty sm">No instructions in Mealie.</div>`}</section>
        </div>
        ${r.notes.length
          ? html`<div class="cnotes"><h3><ha-icon icon="mdi:lightbulb-on-outline"></ha-icon>Notes</h3>${r.notes.map((n) => html`${n.title ? html`<strong>${n.title}</strong>` : ""}${n.text ? html`<p>${n.text}</p>` : ""}`)}</div>`
          : ""}
        ${r.nutrition.length ? html`<div class="cnutrition">${r.nutrition.map((n) => html`<div><span>${n.label}</span><strong>${n.value}</strong></div>`)}</div>` : ""}
      </div>
      <div class="cook-timers" data-cook-timers></div>`;
  }

  /** After a full render of the cooking view: hero image, live timers, keep-awake badge. */
  _cookMounted(d) {
    this._timersRender(true);
    const slot = this.shadowRoot.querySelector("[data-cookimg]");
    if (slot && d.detail?.image_url) this._cookImage(slot, d.detail);
  }

  async _cookImage(slot, detail) {
    if (!this._rimg) this._rimg = new Map();
    const key = `${detail.id}:original`;
    if (!this._rimg.has(key)) {
      try {
        const response = await this._hass.fetchWithAuth(detail.image_url);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (!/^image\/(webp|jpeg|png|gif)$/.test(blob.type)) throw new Error("not an image");
        this._rimg.set(key, URL.createObjectURL(blob));
      } catch (_err) {
        this._rimg.set(key, null);
      }
    }
    if (slot.isConnected) this._showRecipeImage(slot, this._rimg.get(key));
  }

  _cookRefreshSteps(d) {
    for (const el of this.shadowRoot.querySelectorAll(".cook-steps .cstep")) {
      const index = Number(el.dataset.index);
      el.className = this._cookStepClasses(d, index);
      el.setAttribute("aria-pressed", d.done.has(index) ? "true" : "false");
      const position = d.detail.instructions.findIndex((s) => s.index === index);
      el.querySelector(".cnum").textContent = d.done.has(index) ? "✓" : String(position + 1);
    }
    this.shadowRoot.querySelector(".cook-steps .cstep.current")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  _cookAwakeBadge(d) {
    const badge = this.shadowRoot.querySelector("[data-cook-awake]");
    if (!badge || this._dialog !== d) return;
    badge.textContent = d.awake ? this._cookAwakeText(d) : "";
    badge.classList.toggle("on", d.awake && d.awakeStatus === "on");
    this.shadowRoot.querySelector(".cawake")?.classList.toggle("on", d.awake);
  }

  async _wakeOn(d) {
    if (!this._onWakeVisible) {
      // Phones drop the lock when the app is hidden; take it again when the recipe is back on screen.
      this._onWakeVisible = () => {
        const cur = this._dialog;
        if (cur?.kind === "cook" && cur.awake && document.visibilityState === "visible") this._wakeOn(cur);
      };
      document.addEventListener("visibilitychange", this._onWakeVisible);
    }
    if (!("wakeLock" in navigator)) {
      d.awakeStatus = "unsupported";
      return this._cookAwakeBadge(d);
    }
    if (this._wakeLock && !this._wakeLock.released) {
      d.awakeStatus = "on";
      return this._cookAwakeBadge(d);
    }
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (this._dialog !== d || !d.awake) {
        lock.release().catch(() => {});
        return;
      }
      this._wakeLock = lock;
      d.awakeStatus = "on";
      lock.addEventListener("release", () => {
        if (this._wakeLock === lock && this._dialog === d && d.awake) {
          d.awakeStatus = "paused";
          this._cookAwakeBadge(d);
        }
      });
    } catch (_err) {
      d.awakeStatus = document.visibilityState === "visible" ? "blocked" : "paused";
    }
    this._cookAwakeBadge(d);
  }

  _wakeOff() {
    if (this._onWakeVisible) {
      document.removeEventListener("visibilitychange", this._onWakeVisible);
      this._onWakeVisible = null;
    }
    const lock = this._wakeLock;
    this._wakeLock = null;
    if (lock && !lock.released) lock.release().catch(() => {});
  }

  /** Called whenever a dialog closes or is replaced. */
  _cookClosed(d) {
    if (d?.kind !== "cook") return;
    this._wakeOff();
    this._timers = [];
    clearInterval(this._timerTick);
    this._timerTick = null;
  }

  /* -------- kitchen timers -------- */

  _timerStart(seconds, label) {
    if (!(seconds > 0)) return;
    try {
      // Created inside the tap so iOS lets it play later.
      this._audio = this._audio || new (window.AudioContext || window.webkitAudioContext)();
      this._audio.resume?.();
    } catch (_err) {
      this._audio = null;
    }
    this._timerSeq = (this._timerSeq || 0) + 1;
    this._timers = [...(this._timers || []), { id: this._timerSeq, label, total: seconds, endsAt: Date.now() + seconds * 1000, left: seconds, paused: false, done: false }];
    if (!this._timerTick) this._timerTick = setInterval(() => this._timersTick(), 500);
    this._timersRender(true);
  }

  _timersTick() {
    const now = Date.now();
    let changed = false;
    for (const t of this._timers || []) {
      if (t.paused || t.done) continue;
      t.left = (t.endsAt - now) / 1000;
      if (t.left <= 0) {
        t.left = 0;
        t.done = true;
        changed = true;
        this._timerAlarm(t);
      }
    }
    if (!(this._timers || []).some((t) => !t.done && !t.paused) && !(this._timers || []).some((t) => t.done)) {
      clearInterval(this._timerTick);
      this._timerTick = null;
    }
    this._timersRender(changed);
  }

  _timerAlarm(t) {
    try {
      if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.([300, 120, 300, 120, 300]);
    } catch (_err) {
      /* no vibration */
    }
    const ctx = this._audio;
    if (ctx) {
      try {
        const now = ctx.currentTime;
        for (const offset of [0, 0.4, 0.8, 1.6, 2.0, 2.4]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.32);
        }
      } catch (_err) {
        /* audio blocked */
      }
    }
    this._showToast(`⏱️ ${t.label} — time's up!`);
  }

  /** ``structure``: rebuild the bar (timers added/removed/finished); otherwise only the clocks change. */
  _timersRender(structure = false) {
    const bar = this.shadowRoot.querySelector("[data-cook-timers]");
    if (!bar) return;
    const timers = this._timers || [];
    if (structure || bar.childElementCount !== timers.length) {
      setHTML(
        bar,
        html`${timers.map(
          (t) => html`<div class="ctbar ${t.done ? "done" : t.paused ? "paused" : ""}" data-timer="${t.id}" role="timer">
            <ha-icon icon="${t.done ? "mdi:bell-ring" : "mdi:timer-outline"}"></ha-icon><span class="grow">${t.label}</span>
            <span class="ctime">${t.done ? "Done!" : fmtClock(t.left)}</span>
            ${t.done
              ? html`<button class="btn small" data-action="c-timer-cancel" data-id="${t.id}">Dismiss</button>`
              : html`<button class="icon-btn sm" data-action="c-timer-pause" data-id="${t.id}" aria-label="${t.paused ? "Resume" : "Pause"}"><ha-icon icon="${t.paused ? "mdi:play" : "mdi:pause"}"></ha-icon></button>
                <button class="icon-btn sm" data-action="c-timer-add" data-id="${t.id}" aria-label="Add a minute" title="+1 min"><ha-icon icon="mdi:plus"></ha-icon></button>
                <button class="icon-btn sm" data-action="c-timer-cancel" data-id="${t.id}" aria-label="Cancel timer"><ha-icon icon="mdi:close"></ha-icon></button>`}
          </div>`,
        )}`,
      );
      return;
    }
    for (const t of timers) {
      const clock = bar.querySelector(`[data-timer="${t.id}"] .ctime`);
      if (clock && !t.done) clock.textContent = fmtClock(t.left);
    }
  }

  _timerFind(id) {
    return (this._timers || []).find((t) => t.id === Number(id));
  }

  async _cookAction(action, el) {
    const d = this._dialog;
    switch (action) {
      case "c-open":
        return this._cookOpen(el.dataset.slug, el.dataset.name);
      case "c-awake":
        d.awake = el.checked;
        if (d.awake) return this._wakeOn(d);
        this._wakeOff();
        d.awakeStatus = null;
        return this._cookAwakeBadge(d);
      case "c-scale": {
        d.scale = Number(el.dataset.id) || 1;
        for (const chip of this.shadowRoot.querySelectorAll(".cscale .chip")) {
          const on = Number(chip.dataset.id) === d.scale;
          chip.classList.toggle("on", on);
          chip.setAttribute("aria-pressed", on ? "true" : "false");
        }
        const section = this.shadowRoot.querySelector(".cook-ings");
        if (section) setHTML(section, this._cookIngredientsHtml(d));
        const yieldEl = this.shadowRoot.querySelector("[data-cook-yield]");
        if (yieldEl) yieldEl.textContent = this._cookYield(d) || "";
        return;
      }
      case "c-ing": {
        const index = Number(el.dataset.index);
        if (el.checked) d.got.add(index);
        else d.got.delete(index);
        el.closest(".cing")?.classList.toggle("got", el.checked);
        return;
      }
      case "c-step": {
        const index = Number(el.dataset.index);
        if (d.done.has(index)) d.done.delete(index);
        else d.done.add(index);
        return this._cookRefreshSteps(d);
      }
      case "c-timer":
        return this._timerStart(Number(el.dataset.seconds), el.dataset.label || "Timer");
      case "c-timer-pause": {
        const t = this._timerFind(el.dataset.id);
        if (!t) return;
        if (t.paused) {
          t.endsAt = Date.now() + t.left * 1000;
          t.paused = false;
          if (!this._timerTick) this._timerTick = setInterval(() => this._timersTick(), 500);
        } else {
          t.left = Math.max(0, (t.endsAt - Date.now()) / 1000);
          t.paused = true;
        }
        return this._timersRender(true);
      }
      case "c-timer-add": {
        const t = this._timerFind(el.dataset.id);
        if (!t) return;
        if (t.paused) t.left += 60;
        else t.endsAt += 60000;
        t.left = t.paused ? t.left : (t.endsAt - Date.now()) / 1000;
        return this._timersRender(false);
      }
      case "c-timer-cancel":
        this._timers = (this._timers || []).filter((t) => t.id !== Number(el.dataset.id));
        return this._timersRender(true);
      case "c-add-missing": {
        const plan = this._groceryPlan();
        const indices = d.detail.ingredients.filter((row) => row.type === "ingredient" && !row.skip).map((row) => row.index);
        if (!plan || !indices.length) return;
        el.disabled = true;
        try {
          const res = await this._call({ type: "taskdragon/mealie_add_recipe_to_groceries", recipe_slug: d.slug, plan_id: plan.id, ingredients: indices, scale: d.scale });
          this._recipeResultToast(res);
        } finally {
          el.disabled = false;
        }
        return;
      }
      default:
        return;
    }
  }

  /* ---------------- Settings, backup, restore & standalone bridge ---------------- */

  async _settingsOpen() {
    const admin = !!this._board.user?.is_admin;
    const d = { kind: "settings", admin, barcode: null, backups: null, error: null, mode: "merge", report: null, busy: null };
    this._openDialog(d);
    const jobs = [this._store.call({ type: "taskdragon/barcode_settings" }).then((s) => (d.barcode = s))];
    if (admin) jobs.push(this._store.call({ type: "taskdragon/backup_list" }).then((b) => (d.backups = b)));
    try {
      await Promise.all(jobs);
    } catch (err) {
      d.error = err.message || String(err);
    }
    if (this._dialog === d) this._renderDialog();
  }

  _settingsHtml(d) {
    const keepAwake = this._keepAwakeDefault();
    const backups = d.backups;
    const snapshots = backups?.snapshots || [];
    const busy = (key) => (d.busy === key ? html`disabled` : "");
    const backupCard = !d.admin
      ? html`<div class="empty sm">Only a Home Assistant administrator can download, snapshot or restore TaskDragon backups.</div>`
      : !backups
        ? html`<div class="empty sm">${d.error ? `Couldn't load backups: ${d.error}` : "Loading backups…"}</div>`
        : html`<div class="bk-actions">
              <button class="btn" data-action="b-download" ${busy("download")}><ha-icon icon="mdi:download"></ha-icon>Download portable backup (.zip)</button>
              <button class="btn flat" data-action="b-snapshot" ${busy("snapshot")}><ha-icon icon="mdi:content-save-outline"></ha-icon>Trigger local server snapshot now</button>
            </div>
            <div class="bk-schedule">
              <label class="inline"><input type="checkbox" data-action="b-auto" ${backups.settings.enabled ? html`checked` : ""}>Daily snapshot at</label>
              <input type="time" data-bk-setting="time" value="${backups.settings.time}" aria-label="Snapshot time">
              <label class="inline">keep the last <input type="number" min="1" max="365" data-bk-setting="retention" value="${backups.settings.retention}" aria-label="Snapshots to keep"> snapshots</label>
            </div>
            <div class="lastdone">Snapshots are written to <code>/config/${backups.directory}/</code> on the Home Assistant server. Automations can call <code>taskdragon.create_backup</code> before updates.</div>
            <div class="bk-list">${snapshots.length
              ? snapshots.map(
                  (s) => html`<div class="bk-row"><span class="grow"><strong>${new Date(s.taken_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong>
                      ${s.kind === "pre_restore" ? html` <span class="badge today">before a restore</span>` : ""}<small>${s.name} · ${fmtBytes(s.size)}</small></span>
                    <button class="btn small flat" data-action="b-snap-download" data-id="${s.name}"><ha-icon icon="mdi:download"></ha-icon>Download</button>
                    <button class="btn small flat" data-action="b-snap-restore" data-id="${s.name}" ${busy("restore")}><ha-icon icon="mdi:backup-restore"></ha-icon>Restore</button>
                    <button class="icon-btn sm" data-action="b-snap-delete" data-id="${s.name}" aria-label="Delete ${s.name}"><ha-icon icon="mdi:delete-outline"></ha-icon></button></div>`,
                )
              : html`<div class="empty sm">No snapshots yet.</div>`}</div>
            <h3 style="margin-top:16px"><ha-icon icon="mdi:upload"></ha-icon>Upload &amp; restore a backup file</h3>
            <div class="bk-modes" role="radiogroup" aria-label="Restore mode">
              <label><input type="radio" name="bk-mode" value="merge" data-bk-mode ${d.mode === "merge" ? html`checked` : ""}><span><strong>Merge import</strong> — adds what's missing, never deletes or overwrites anything here.</span></label>
              <label><input type="radio" name="bk-mode" value="replace" data-bk-mode ${d.mode === "replace" ? html`checked` : ""}><span><strong>Full disaster-recovery replace</strong> — <span class="bk-warn">everything here is replaced</span> by the backup.</span></label>
            </div>
            <div class="bk-upload"><input type="file" data-bk-file accept=".zip,.json,application/zip,application/json" aria-label="Backup file">
              <button class="btn" data-action="b-upload" ${busy("restore")}><ha-icon icon="mdi:backup-restore"></ha-icon>Restore</button></div>
            <div class="lastdone">A safety snapshot of the current data is written first, and every file is checked against its SHA-256 before anything changes. Restores from snapshots above use the same mode.</div>
            ${d.report ? this._settingsReportHtml(d.report) : ""}
            <details style="margin-top:12px"><summary>What's in a portable backup?</summary>
              <div class="lastdone">A <code>.zip</code> with <code>manifest_bridge.json</code> (checksums, a portable profile for every person and a map of every Home Assistant entity, NFC tag, area and service TaskDragon uses), <code>database_dump.json</code> (every table as plain JSON), a hot copy of <code>taskdragon.db</code> and every uploaded manual, receipt and photo. It's enough to rebuild TaskDragon on another Home Assistant, or to move it to a standalone app later.</div>
            </details>`;
    return html`<h2><span class="grow">TaskDragon settings</span>${this._closeButton()}</h2>
      <div class="mcard"><h3><ha-icon icon="mdi:cellphone"></ha-icon>On this device</h3>
        <label class="inline rrow"><input type="checkbox" data-action="b-keep-awake" ${keepAwake ? html`checked` : ""}><span class="grow">Keep the screen on whenever I open a recipe</span></label>
      </div>
      <div class="mcard"><h3><ha-icon icon="mdi:barcode-scan"></ha-icon>Barcode scanning</h3>
        ${d.barcode
          ? html`<label class="inline rrow"><input type="checkbox" data-action="b-off" ${d.barcode.openfoodfacts ? html`checked` : ""} ${d.admin ? "" : html`disabled`}>
              <span class="grow">Look up unknown barcodes on Open Food Facts</span></label>
            <div class="lastdone">Only the barcode number is sent, from Home Assistant, to suggest a product name.${d.admin ? "" : " An administrator can change this."}</div>`
          : html`<div class="empty sm">${d.error ? d.error : "Loading…"}</div>`}
      </div>
      <div class="mcard"><h3><ha-icon icon="mdi:database-export-outline"></ha-icon>Backup, Restore &amp; Standalone Bridge</h3>${backupCard}</div>`;
  }

  _settingsReportHtml(report) {
    if (report.error) return html`<div class="bk-report bk-warn"><strong>Restore failed:</strong> ${report.error}</div>`;
    const totals = report.totals || {};
    return html`<div class="bk-report"><strong>${report.mode === "replace" ? "Replaced" : "Merged"} from ${report.source || "the uploaded file"}</strong>
      <ul><li>${totals.inserted || 0} rows restored${totals.skipped ? `, ${totals.skipped} already here` : ""}${totals.removed ? `, ${totals.removed} orphaned rows dropped` : ""}</li>
        <li>${report.documents?.restored || 0} documents restored${report.documents?.missing ? `, ${report.documents.missing} were missing from the backup` : ""}</li>
        <li>Safety snapshot: ${report.safety_snapshot}</li>
        ${(report.warnings || []).map((w) => html`<li>${w}</li>`)}</ul></div>`;
  }

  async _settingsReload(d) {
    try {
      d.backups = await this._store.call({ type: "taskdragon/backup_list" });
    } catch (err) {
      d.error = err.message || String(err);
    }
    if (this._dialog === d) this._renderDialog();
  }

  _afterRestore(d, report) {
    d.report = report;
    this._maintBoards = {};
    this._mRefresh();
    this._recipes = null;
    this._store.refresh();
    this._showToast(`Restore finished — safety snapshot ${report.safety_snapshot}`);
    return this._settingsReload(d);
  }

  async _settingsAction(action, el) {
    const d = this._dialog;
    switch (action) {
      case "b-open-settings":
        return this._settingsOpen();
      case "b-keep-awake":
        storage.set(KEEP_AWAKE_KEY, el.checked ? "1" : "0");
        return;
      case "b-off":
        try {
          d.barcode = await this._call({ type: "taskdragon/barcode_settings", settings: { openfoodfacts: el.checked } });
        } catch (_err) {
          el.checked = !el.checked;
        }
        return;
      case "b-auto":
        return this._settingsSave(d, { enabled: el.checked });
      case "b-download":
        return this._mOpenSigned("/api/taskdragon/backup/download", "", 30);
      case "b-snap-download":
        return this._mOpenSigned(`/api/taskdragon/backup/download?snapshot=${encodeURIComponent(el.dataset.id)}`, "", 30);
      case "b-snapshot": {
        d.busy = "snapshot";
        this._renderDialog();
        try {
          const snap = await this._call({ type: "taskdragon/backup_create" });
          this._showToast(`Snapshot saved: ${snap.name} (${fmtBytes(snap.size)})`);
        } catch (_err) {
          /* shown by _call */
        }
        d.busy = null;
        return this._settingsReload(d);
      }
      case "b-snap-delete": {
        if (!confirm(`Delete the snapshot ${el.dataset.id}?`)) return;
        await this._call({ type: "taskdragon/backup_delete", name: el.dataset.id });
        return this._settingsReload(d);
      }
      case "b-snap-restore": {
        const mode = d.mode;
        const warning = mode === "replace" ? "Everything in TaskDragon will be REPLACED by this snapshot." : "Missing items from this snapshot will be added; nothing is deleted.";
        if (!confirm(`${warning}\n\nA safety snapshot is taken first. Restore ${el.dataset.id}?`)) return;
        d.busy = "restore";
        this._renderDialog();
        try {
          const report = await this._call({ type: "taskdragon/backup_restore_snapshot", name: el.dataset.id, mode });
          d.busy = null;
          return this._afterRestore(d, report);
        } catch (err) {
          d.busy = null;
          d.report = { error: err.message || String(err) };
          return this._renderDialog();
        }
      }
      case "b-upload": {
        const file = this.shadowRoot.querySelector("[data-bk-file]")?.files?.[0];
        if (!file) return this._showToast("Choose a backup file first");
        const mode = d.mode;
        if (mode === "replace" && !confirm(`Everything in TaskDragon will be REPLACED by ${file.name}.\n\nA safety snapshot is taken first. Continue?`)) return;
        d.busy = "restore";
        this._renderDialog();
        try {
          const body = new FormData();
          body.append("mode", mode);
          body.append("file", file, file.name);
          const response = await this._hass.fetchWithAuth("/api/taskdragon/backup/restore", { method: "POST", body });
          const data = await response.json().catch(() => ({}));
          d.busy = null;
          if (!response.ok) {
            d.report = { error: data.message || `HTTP ${response.status}` };
            return this._renderDialog();
          }
          return this._afterRestore(d, { ...data, source: file.name });
        } catch (err) {
          d.busy = null;
          d.report = { error: err.message || String(err) };
          return this._renderDialog();
        }
      }
      default:
        return;
    }
  }

  async _settingsSave(d, changes) {
    try {
      const settings = await this._call({ type: "taskdragon/backup_settings", settings: changes });
      if (d.backups) d.backups.settings = settings;
    } catch (_err) {
      /* shown by _call */
    }
    return this._settingsReload(d);
  }

  /** change events inside the scan link drawer, the settings dialog and the cooking view. */
  _extrasChange(el) {
    const data = el.dataset || {};
    const d = this._dialog;
    if (data.slinkPick !== undefined && d?.kind === "scan-link") {
      d.selected[d.type] = data.slinkPick;
      for (const row of this.shadowRoot.querySelectorAll(".slink-row")) row.classList.toggle("on", row.querySelector("input")?.dataset.slinkPick === data.slinkPick);
      return true;
    }
    if (data.bkMode !== undefined && d?.kind === "settings") {
      d.mode = el.value;
      return true;
    }
    if (data.bkSetting && d?.kind === "settings") {
      const value = data.bkSetting === "retention" ? Number(el.value) : el.value;
      if (data.bkSetting === "retention" && !(value >= 1 && value <= 365)) return true;
      this._settingsSave(d, { [data.bkSetting]: value });
      return true;
    }
    return false;
  }

  /** input events (typing) for the scan link drawer search. */
  _extrasInput(el) {
    const d = this._dialog;
    if (el.dataset?.slinkSearch !== undefined && d?.kind === "scan-link") {
      d.query = el.value;
      const list = this.shadowRoot.querySelector(".slink-list");
      if (list) setHTML(list, this._scanLinkListHtml(d));
      return true;
    }
    return false;
  }

  /* ---------------- Wishlist, gifts & price tracker: data ---------------- */

  _hUi() {
    if (!this._ui.hoard) this._ui.hoard = { section: "all", revealAll: false, revealed: new Set() };
    return this._ui.hoard;
  }

  _hPlanId() {
    const tab = this._currentTab();
    return this._idx.plans.get(tab)?.archetype === "wishlist_hoard" ? tab : null;
  }

  _hData(planId) {
    return (this._hoardBoards || {})[planId];
  }

  _hBoard() {
    const planId = this._hPlanId();
    return planId ? this._hData(planId) : null;
  }

  _queueHoardLoad(planId) {
    clearTimeout(this._hoardTimer);
    this._hoardTimer = setTimeout(() => this._loadHoard(planId), 120);
  }

  async _loadHoard(planId) {
    if (!planId || !this._store) return null;
    try {
      const board = await this._store.call({ type: "taskdragon/hoard_board", plan_id: planId });
      this._hoardBoards = { ...(this._hoardBoards || {}), [planId]: board };
      this._hoardError = null;
    } catch (err) {
      this._hoardError = err.message || String(err);
    }
    if (this._hoardPending === planId) this._hoardPending = null;
    if (this._currentTab() === planId) this._renderBody();
    this._hSyncDialog(planId);
    return this._hData(planId);
  }

  /** Keep an open item sheet showing the latest data after a reload. */
  _hSyncDialog(planId) {
    const d = this._dialog;
    if (!d || d.kind !== "hoard-detail" || d.planId !== planId) return;
    const fresh = this._hItem(planId, d.item.id);
    if (!fresh) return this._closeDialog();
    d.item = fresh;
    this._renderDialog();
  }

  _hItem(planId, itemId) {
    return (this._hData(planId)?.items || []).find((i) => i.id === itemId) || null;
  }

  /** Put a changed item (as returned by the server) into the cached board right away. */
  _hPut(item) {
    const hb = this._hData(item.plan_id);
    if (!hb) return;
    const index = hb.items.findIndex((i) => i.id === item.id);
    if (index >= 0) hb.items[index] = item;
    else hb.items.push(item);
    if (this._currentTab() === item.plan_id) this._renderBody();
    if (this._dialog?.kind === "hoard-detail" && this._dialog.item.id === item.id) {
      this._dialog.item = item;
      this._renderDialog();
    }
  }

  _hCurrency(hb) {
    return hb?.plan?.settings?.currency || "$";
  }

  _hMoney(value, hb = this._hBoard()) {
    if (value === null || value === undefined || value === "") return "";
    const currency = this._hCurrency(hb);
    const text = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency.length === 1 ? `${currency}${text}` : `${text} ${currency}`;
  }

  _hAgo(iso) {
    if (!iso) return "never";
    const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!Number.isFinite(seconds) || seconds < 90) return "just now";
    if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
    if (seconds < 86400 * 2) return `${Math.round(seconds / 3600)} h ago`;
    return `${Math.round(seconds / 86400)} days ago`;
  }

  _hSection(hb, id) {
    return (hb?.sections || []).find((s) => s.id === id) || null;
  }

  /** Occasions (top-level sections); categories sit under one of them. */
  _hTop(hb) {
    return (hb?.sections || []).filter((s) => !s.parent_id || !this._hSection(hb, s.parent_id));
  }

  _hChildren(hb, id) {
    return (hb?.sections || []).filter((s) => s.parent_id === id);
  }

  /** The section and its categories' ids. */
  _hFamily(hb, id) {
    return new Set([id, ...this._hChildren(hb, id).map((c) => c.id)]);
  }

  _hKiosk() {
    return this._mode() === "kiosk_split";
  }

  /** Secret gifts stay covered on a shared wall tablet until someone reveals them. */
  _hMasked(item) {
    const ui = this._hUi();
    return item.secret && this._hKiosk() && !ui.revealAll && !ui.revealed.has(item.id);
  }

  _hStatus(status) {
    return HOARD_STATUSES.find(([key]) => key === status) || HOARD_STATUSES[0];
  }

  _hStatusesFor(hb, item) {
    const section = this._hSection(hb, item.section_id);
    const giftish = section?.is_gift || item.gift_for_person_id || item.recipient_name;
    return giftish ? HOARD_STATUSES : HOARD_STATUSES.filter(([key]) => HOARD_WANT_STATUSES.includes(key));
  }

  _hNextStatus(hb, item) {
    const list = this._hStatusesFor(hb, item).map(([key]) => key);
    const index = list.indexOf(item.status);
    return index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  }

  /** Items at their target, claimable price drops and fresh deals (the category's badge). */
  _hAttention(hb) {
    return (hb?.items || []).filter((i) => i.meets_target || i.protection?.claim || i.deals.length).length;
  }

  _hFilteredItems(hb) {
    const q = (this._ui.search || "").trim().toLowerCase();
    let items = hb.items;
    const ui = this._hUi();
    if (ui.section === "unsorted") items = items.filter((i) => !i.section_id);
    else if (ui.section !== "all") {
      const family = this._hFamily(hb, ui.section);
      items = items.filter((i) => family.has(i.section_id));
    }
    if (q) items = items.filter((i) => [i.title, i.spec_notes, i.brand, i.model, i.recipient_name].some((v) => String(v || "").toLowerCase().includes(q)));
    const order = Object.fromEntries(HOARD_STATUSES.map(([key], index) => [key, index]));
    return [...items].sort((a, b) => (a.status === "gifted") - (b.status === "gifted") || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || order[a.status] - order[b.status] || a.position - b.position);
  }

  /* ---------------- Wishlist: main view ---------------- */

  _hoardHtml(plan) {
    const hb = this._hData(plan.id);
    if (!hb) {
      if (this._hoardError) {
        return html`<div class="empty">The wishlist is unavailable: ${this._hoardError} <button class="link" data-action="h-retry" data-id="${plan.id}">Retry</button></div>`;
      }
      if (this._hoardPending !== plan.id) {
        this._hoardPending = plan.id;
        this._queueHoardLoad(plan.id);
      }
      return html`<div class="empty">Loading the wishlist…</div>`;
    }
    const ui = this._hUi();
    const picked = this._hSection(hb, ui.section);
    if (picked?.parent_id && this._hSection(hb, picked.parent_id)) ui.section = picked.parent_id;
    else if (ui.section !== "all" && ui.section !== "unsorted" && !picked) ui.section = "all";
    const items = this._hFilteredItems(hb);
    const section = this._hSection(hb, ui.section);
    let body;
    if (ui.section === "all") {
      const groups = [
        ...this._hTop(hb).map((s) => {
          const family = this._hFamily(hb, s.id);
          return { section: s, items: items.filter((i) => family.has(i.section_id)) };
        }),
        { section: null, items: items.filter((i) => !i.section_id || !this._hSection(hb, i.section_id)) },
      ];
      const shown = groups.filter((g) => g.items.length || (g.section && hb.hidden.some((h) => h.section_id === g.section.id)));
      body = shown.length
        ? shown.map((g) => html`<div class="hgroup-head"><ha-icon icon="${g.section?.icon || "mdi:tray"}"></ha-icon><span>${g.section ? g.section.name : "Unsorted"}</span>${g.section?.days_left !== null && g.section?.days_left !== undefined ? html`<span class="badge">${this._hCountdown(g.section)}</span>` : ""}<span class="grow"></span></div>
            ${this._hHiddenHtml(hb, g.section ? g.section.id : null)}
            ${g.section ? this._hCategoriesHtml(hb, g.section, g.items, false) : html`<div class="hgrid">${g.items.map((item) => this._hCardHtml(hb, item))}</div>`}`)
        : html`<div class="empty">${this._ui.search ? "Nothing matches your search." : "Nothing here yet — add an idea like “4k monitor”, or scan a barcode in a store."}</div>`;
    } else if (section) {
      body = html`${this._hBudgetHtml(hb, section)}${this._hHiddenHtml(hb, section.id)}${this._hCategoriesHtml(hb, section, items, true)}`;
    } else {
      body = html`${this._hHiddenHtml(hb, null)}
        ${items.length ? html`<div class="hgrid">${items.map((item) => this._hCardHtml(hb, item))}</div>` : html`<div class="empty">${this._ui.search ? "Nothing matches your search." : "Nothing unsorted."}</div>`}`;
    }
    return html`<div class="hoard">${this._hToolbarHtml(hb, plan)}${this._hPillsHtml(hb)}${ui.section === "all" ? this._hHiddenHtml(hb, null, true) : ""}${body}</div>`;
  }

  /** One row: add an idea (Enter, or + for the full form) and the in-store price check. Settings live in the ⋮ menu. */
  _hToolbarHtml(hb, plan) {
    const ui = this._hUi();
    const kiosk = this._hKiosk();
    const section = this._hSection(hb, ui.section);
    return html`<div class="htools">
      <div class="hadd"><input data-hoard-input="${plan.id}" data-focus="hoard-add-${plan.id}" maxlength="200" placeholder="${section ? `Add to ${section.name}…` : "Add an idea… e.g. 4k monitor"}" enterkeyhint="done" aria-label="Add an idea">
        <button class="icon-btn" data-action="h-add" data-plan="${plan.id}" title="Add with details" aria-label="Add with details"><ha-icon icon="mdi:plus"></ha-icon></button></div>
      <button class="hscan" data-action="h-scan" data-plan="${plan.id}" title="In-store scan & price check" aria-label="In-store scan and price check"><ha-icon icon="mdi:barcode-scan"></ha-icon><span>Price check</span></button>
    </div>
    ${kiosk ? html`<div><button class="chip ${ui.revealAll ? "on" : ""}" data-action="h-reveal-all"><ha-icon icon="${ui.revealAll ? "mdi:lock-open-variant-outline" : "mdi:lock-outline"}"></ha-icon>${ui.revealAll ? "Hide secret gifts" : "Show secret gifts"}</button></div>` : ""}`;
  }

  _hPillsHtml(hb) {
    const ui = this._hUi();
    const count = (id) => {
      const family = this._hFamily(hb, id);
      return hb.items.filter((i) => family.has(i.section_id) && i.status !== "gifted").length;
    };
    const unsorted = hb.items.filter((i) => !i.section_id).length;
    return html`<div class="hpills" role="tablist" aria-label="Sections">
      <button class="chip ${ui.section === "all" ? "on" : ""}" data-action="h-section" data-id="all" role="tab" aria-selected="${ui.section === "all" ? "true" : "false"}">All <span class="n">${hb.items.length}</span></button>
      ${this._hTop(hb).map(
        (s) => html`<button class="chip ${ui.section === s.id ? "on" : ""}" data-action="h-section" data-id="${s.id}" role="tab" aria-selected="${ui.section === s.id ? "true" : "false"}"><ha-icon icon="${s.icon || "mdi:tag-outline"}"></ha-icon>${s.name}${s.stealth_mode ? html` <ha-icon icon="mdi:incognito"></ha-icon>` : ""} <span class="n">${count(s.id)}</span></button>`,
      )}
      ${unsorted ? html`<button class="chip ${ui.section === "unsorted" ? "on" : ""}" data-action="h-section" data-id="unsorted">Unsorted <span class="n">${unsorted}</span></button>` : ""}
      <button class="chip ghost" data-action="h-new-section"><ha-icon icon="mdi:plus"></ha-icon>New section</button>
    </div>`;
  }

  _hCountdown(section) {
    const days = section.days_left;
    if (days === null || days === undefined) return "";
    if (days < 0) return `${-days} days ago`;
    if (days === 0) return "Today!";
    if (days === 1) return "Tomorrow";
    return `${days} days to go`;
  }

  _hBudgetHtml(hb, section) {
    const s = section.summary;
    const budget = section.budget;
    const pct = budget ? Math.min(100, Math.round((s.spent / budget) * 100)) : 0;
    const level = budget && s.spent > budget ? "over" : budget && pct >= 85 ? "near" : "";
    const who = section.gift_for_person_id ? this._person(section.gift_for_person_id).name : section.recipient_name;
    return html`<div class="hbudget">
      <div class="hrow">
        <span class="spent">Spent: ${this._hMoney(s.spent, hb)}${budget ? html` / ${this._hMoney(budget, hb)} budget` : ""}</span>
        <span>${s.bought} bought · ${s.watching} watching · ${s.wrapped} wrapped${s.ideas ? ` · ${s.ideas} ideas` : ""}</span>
        <span class="grow"></span>
        ${section.days_left !== null && section.days_left !== undefined ? html`<span class="hcount"><ha-icon icon="mdi:calendar-clock"></ha-icon>${this._hCountdown(section)}</span>` : ""}
      </div>
      ${budget ? html`<div class="hbar ${level}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Budget used"><span style="width:${pct}%"></span></div>` : ""}
      <div class="hrow">
        ${who ? html`<span class="badge"><ha-icon icon="mdi:account-heart-outline"></ha-icon>For ${who}</span>` : ""}
        ${section.stealth_mode ? html`<span class="badge"><ha-icon icon="mdi:incognito"></ha-icon>Secret section (only you can see it)</span>` : ""}
        ${budget && s.spent > budget ? html`<span class="badge overdue">${this._hMoney(s.spent - budget, hb)} over budget</span>` : budget ? html`<span class="badge ok">${this._hMoney(budget - s.spent, hb)} left</span>` : ""}
        ${s.hidden ? html`<span class="badge">+ ${s.hidden} secret</span>` : ""}
        <span class="grow"></span>
        <button class="link" data-action="h-edit-section" data-id="${section.id}">Edit section</button>
      </div>
    </div>`;
  }

  /** An occasion's items: its own first, then a block per category (Christmas → Ellie, Grandma, Stocking stuffers). */
  _hCategoriesHtml(hb, section, items, full) {
    const kids = this._hChildren(hb, section.id);
    const own = items.filter((i) => i.section_id === section.id);
    const searching = !!(this._ui.search || "").trim();
    const cards = (list) => html`<div class="hgrid">${list.map((item) => this._hCardHtml(hb, item))}</div>`;
    const blocks = [];
    if (own.length) blocks.push(cards(own));
    else if (full && !kids.length) blocks.push(html`<div class="empty">${searching ? "Nothing matches your search." : "No items in this section yet."}</div>`);
    for (const kid of kids) {
      const list = items.filter((i) => i.section_id === kid.id);
      if (!list.length && (!full || searching)) continue;
      const who = kid.gift_for_person_id ? this._person(kid.gift_for_person_id).name : kid.recipient_name;
      const spent = kid.summary?.spent || 0;
      const icon = kid.gift_for_person_id || kid.recipient_name || section.is_gift ? "mdi:account-heart-outline" : kid.icon || "mdi:tag-outline";
      blocks.push(html`<div class="hcat">
        <div class="hcat-head">
          <ha-icon icon="${icon}"></ha-icon><span class="name">${kid.name}</span>
          ${who && who !== kid.name ? html`<span class="badge"><ha-icon icon="mdi:gift-outline"></ha-icon>For ${who}</span>` : ""}
          ${kid.stealth_mode ? html`<span class="badge" title="Only you can see this"><ha-icon icon="mdi:incognito"></ha-icon>Only you</span>` : ""}
          <span class="n">${list.length}</span>
          ${kid.budget ? html`<span class="hcat-budget ${spent > kid.budget ? "over" : ""}">${this._hMoney(spent, hb)} / ${this._hMoney(kid.budget, hb)}</span>` : spent ? html`<span class="hcat-budget">${this._hMoney(spent, hb)} spent</span>` : ""}
          <span class="grow"></span>
          <button class="icon-btn sm" data-action="h-add" data-section="${kid.id}" title="Add to ${kid.name}" aria-label="Add to ${kid.name}"><ha-icon icon="mdi:plus"></ha-icon></button>
          <button class="icon-btn sm" data-action="h-edit-section" data-id="${kid.id}" title="Edit ${kid.name}" aria-label="Edit ${kid.name}"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
        </div>
        ${list.length ? cards(list) : html`<div class="empty sm">Nothing for ${kid.name} yet — tap + to add an idea.</div>`}
      </div>`);
    }
    if (full && !searching) {
      blocks.push(html`<button class="chip ghost hcat-add" data-action="h-new-category" data-id="${section.id}"><ha-icon icon="${section.is_gift ? "mdi:account-plus-outline" : "mdi:folder-plus-outline"}"></ha-icon>${section.is_gift ? `Add a person or list to ${section.name}` : `Add a category to ${section.name}`}</button>`);
    }
    return html`${blocks}`;
  }

  /** "🐉 2 secret gifts hidden by Sam" — what the server reports instead of items this user may not see. */
  _hHiddenHtml(hb, sectionId, wholeSections = false) {
    const rows = hb.hidden.filter((h) => (wholeSections ? h.section_id === null : sectionId !== null && h.section_id === sectionId));
    if (!rows.length) return "";
    return html`<div class="hhidden">${rows.map(
      (h) => html`<span class="badge">🐉 ${h.count} secret ${h.count === 1 ? "gift" : "gifts"} hidden by ${h.buyer}</span>`,
    )}</div>`;
  }

  _hThumb(item, large = false) {
    const icon = html`<ha-icon icon="${item.tier === "concept" ? "mdi:tag-outline" : "mdi:storefront-outline"}"></ha-icon>`;
    const path = /^\/api\/taskdragon\/hoard_image\/[^/?#]+\?v=[0-9a-f]+$/.test(item.image_path || "") ? item.image_path : null;
    if (path) return html`<span class="hthumb ${large ? "lg" : ""}" data-himg="${path}" role="img" aria-label="${item.title}">${icon}</span>`;
    return html`<span class="hthumb ${large ? "lg" : ""}">${icon}</span>`;
  }

  /** Fetch proxied product photos with the user's credentials and show them as object URLs. */
  _hHydrateImages(root) {
    if (!this._himg) this._himg = new Map();
    for (const slot of root.querySelectorAll("[data-himg]")) {
      const path = slot.dataset.himg;
      if (this._himg.has(path)) this._hShowImage(slot, this._himg.get(path));
      else this._hLoadImage(path);
    }
  }

  async _hLoadImage(path) {
    if (!this._himgPending) this._himgPending = new Map();
    if (!this._himgPending.has(path)) {
      this._himgPending.set(
        path,
        (async () => {
          try {
            const response = await this._hass.fetchWithAuth(path);
            if (!response.ok) throw new Error(String(response.status));
            const blob = await response.blob();
            if (!/^image\/(webp|jpeg|png|gif)$/.test(blob.type)) throw new Error("not an image");
            this._himg.set(path, URL.createObjectURL(blob));
          } catch (_err) {
            this._himg.set(path, null); // keep the placeholder icon
          }
          // Old versions of a photo (and anything past 200) give their memory back.
          while (this._himg.size > 200) {
            const [oldest, url] = this._himg.entries().next().value;
            if (url) URL.revokeObjectURL(url);
            this._himg.delete(oldest);
          }
        })(),
      );
    }
    await this._himgPending.get(path);
    this._himgPending.delete(path);
    for (const slot of this.shadowRoot.querySelectorAll(`[data-himg="${CSS.escape(path)}"]`)) this._hShowImage(slot, this._himg.get(path));
  }

  _hShowImage(slot, url) {
    if (!url) return;
    slot.style.backgroundImage = `url("${url}")`;
    slot.replaceChildren();
  }

  _hBadges(hb, item) {
    const who = item.gift_for_person_id ? this._person(item.gift_for_person_id).name : item.recipient_name;
    const status = this._hStatus(item.status);
    return html`${item.tier === "concept" && !HOARD_OWNED.has(item.status) ? html`<span class="badge"><ha-icon icon="mdi:tag-outline"></ha-icon>Concept tag</span>` : ""}
      <span class="badge ${item.status === "watching" ? "today" : HOARD_OWNED.has(item.status) ? "ok" : ""}"><ha-icon icon="${status[2]}"></ha-icon>${status[1]}</span>
      ${item.priority && item.priority !== "none" ? html`<span class="badge ${item.priority === "urgent" ? "urgent" : item.priority === "high" ? "high" : ""}">${item.priority}</span>` : ""}
      ${[item.brand, item.model].filter(Boolean).length ? html`<span class="badge plan">${[item.brand, item.model].filter(Boolean).join(" · ")}</span>` : ""}
      ${who ? html`<span class="badge"><ha-icon icon="mdi:gift-outline"></ha-icon>For ${who}</span>` : ""}
      ${item.stealth_mode ? html`<span class="badge"><ha-icon icon="mdi:incognito"></ha-icon>Only you</span>` : ""}`;
  }

  _hCardHtml(hb, item) {
    if (this._hMasked(item)) {
      return html`<div class="hcard masked secret" data-action="h-reveal" data-id="${item.id}" role="button" tabindex="0" aria-label="Secret gift, tap to reveal">
        <span class="dragon">🐉</span><strong>Secret gift</strong><span class="lastdone">Tap to reveal</span></div>`;
    }
    const best = item.best;
    const others = item.urls.filter((u) => u.last_price !== null && u.id !== best?.url_id).sort((a, b) => a.last_price - b.last_price).slice(0, 2);
    const next = this._hNextStatus(hb, item);
    const statuses = this._hStatusesFor(hb, item);
    const reached = statuses.findIndex(([key]) => key === item.status);
    const p = item.protection;
    return html`<div class="hcard ${item.secret ? "secret" : ""} ${item.status}" data-action="h-open" data-id="${item.id}">
      <div class="htop">${this._hThumb(item)}
        <div class="grow" style="min-width:0"><div class="htitle">${item.title}</div><div class="hsub">${this._hBadges(hb, item)}</div></div></div>
      ${item.tier === "tracked"
        ? html`<div class="hprices">
            ${best
              ? html`<a class="hbest ${best.in_stock === false ? "oos" : ""}" href="${best.url}" title="Open ${best.retailer}">${this._hMoney(best.price, hb)} @ ${best.retailer}</a>`
              : html`<span class="lastdone">Checking prices…</span>`}
            ${others.map((u) => html`<a class="hother" href="${u.url}">${this._hMoney(u.last_price, hb)} @ ${u.retailer_name}</a>`)}
          </div>
          <span class="hspark" data-spark="${JSON.stringify(item.sparkline)}" data-target="${item.target_price ?? ""}" aria-label="Price trend, last 30 days"></span>
          <div class="hfacts">
            ${item.target_price !== null ? html`<span class="${item.meets_target ? "good" : ""}">Target ${this._hMoney(item.target_price, hb)}${item.meets_target ? " ✓" : ""}</span>` : ""}
            ${item.below_average_pct > 0 ? html`<span class="good">${item.below_average_pct}% below average</span>` : ""}
            ${item.all_time_low !== null ? html`<span>Lowest ${this._hMoney(item.all_time_low, hb)}</span>` : ""}
          </div>`
        : HOARD_OWNED.has(item.status)
          ? html`${item.spec_notes ? html`<div class="hnotes">${item.spec_notes}</div>` : ""}
            ${item.paid_price !== null || item.purchase_store ? html`<div class="hfacts"><span>Paid${item.paid_price !== null ? ` ${this._hMoney(item.paid_price, hb)}` : ""}${item.purchase_store ? ` at ${item.purchase_store}` : ""}${item.purchase_date ? ` · ${item.purchase_date}` : ""}</span></div>` : ""}`
          : html`${item.spec_notes ? html`<div class="hnotes">${item.spec_notes}</div>` : ""}
            ${item.target_price !== null ? html`<div class="hfacts"><span>Target: &lt; ${this._hMoney(item.target_price, hb)}</span></div>` : ""}
            <div><button class="btn small flat" data-action="h-open" data-id="${item.id}" data-focus-link="1"><ha-icon icon="mdi:link-variant"></ha-icon>Link store URL or scan barcode</button></div>`}
      ${item.deals.length
        ? html`<details class="hdeals" data-action="noop"><summary>🔥 ${item.deals.length} live deal ${item.deals.length === 1 ? "match" : "matches"} found</summary>
            ${item.deals.slice(0, 5).map((d) => this._hDealHtml(hb, d))}</details>`
        : ""}
      ${p?.claim ? html`<div class="hnote-box claim"><ha-icon icon="mdi:cash-check"></ha-icon><span class="grow">Now ${this._hMoney(p.claim.price, hb)} at ${p.claim.retailer} — claim ${this._hMoney(p.claim.savings, hb)} back (${p.days_left} days left)</span></div>` : ""}
      ${p && p.active && !p.claim ? html`<div class="hnote-box guard"><ha-icon icon="mdi:shield-check-outline"></ha-icon><span class="grow">Refund guard · ${p.days_left} ${p.days_left === 1 ? "day" : "days"} left${item.paid_price !== null ? ` · paid ${this._hMoney(item.paid_price, hb)}` : ""}${item.purchase_store ? ` @ ${item.purchase_store}` : ""}</span></div>` : ""}
      ${item.cooldown?.active ? html`<div class="hnote-box cool"><ha-icon icon="mdi:timer-sand-full"></ha-icon><span class="grow">${item.cooldown.days_left}-day impulse cooldown — let the tracker hunt for a sale</span></div>` : ""}
      ${item.hiding_spot && ["stashed", "wrapped"].includes(item.status) ? html`<div class="hnote-box"><ha-icon icon="mdi:archive-lock-outline"></ha-icon><span class="grow">Hidden: ${item.hiding_spot}</span></div>` : ""}
      ${statuses.length > 3 ? html`<div class="hpipe" aria-label="${this._hStatus(item.status)[1]}">${statuses.map((_s, index) => html`<span class="step ${index <= reached ? "done" : ""}"></span>`)}</div>` : ""}
      <div class="hactions">
        ${next ? html`<button class="btn small" data-action="${next === "purchased" ? "h-purchase" : "h-next"}" data-id="${item.id}"><ha-icon icon="${this._hStatus(next)[2]}"></ha-icon>${next === "purchased" ? "Bought it" : this._hStatus(next)[1]}</button>` : ""}
        <span class="grow"></span>
        ${item.urls.length ? html`<button class="icon-btn sm" data-action="h-check" data-id="${item.id}" title="Check prices now" aria-label="Check prices now"><ha-icon icon="mdi:refresh"></ha-icon></button>` : ""}
      </div>
    </div>`;
  }

  _hDealHtml(hb, d) {
    return html`<div class="hdeal">
      <span class="t"><a href="${d.url}" title="${d.title}">${d.title}</a><div class="lastdone">${d.source === "reddit" ? "Reddit" : "Slickdeals"}${d.posted_at ? ` · ${this._hAgo(d.posted_at)}` : ""}${d.discussion_url && d.discussion_url !== d.url ? html` · <a href="${d.discussion_url}">discussion</a>` : ""}</div></span>
      ${d.price !== null ? html`<span class="p">${this._hMoney(d.price, hb)}</span>` : ""}
      <button class="btn small flat" data-action="h-deal-promote" data-id="${d.id}" title="Track this product's price">Track this</button>
      <button class="icon-btn sm" data-action="h-deal-dismiss" data-id="${d.id}" title="Dismiss" aria-label="Dismiss"><ha-icon icon="mdi:close"></ha-icon></button>
    </div>`;
  }

  /** Draw the price sparklines (built with DOM calls, never markup) and load product photos. */
  _hHydrate(root) {
    this._hHydrateImages(root);
    for (const el of root.querySelectorAll(".hspark[data-spark]")) {
      let points = [];
      try {
        points = JSON.parse(el.dataset.spark || "[]").filter((p) => Array.isArray(p) && Number.isFinite(Number(p[1])));
      } catch (_err) {
        points = [];
      }
      el.removeAttribute("data-spark");
      if (points.length < 2) {
        const note = document.createElement("span");
        note.className = "none";
        note.textContent = points.length ? "One price check so far — the trend appears after the next one" : "No price history yet";
        el.replaceChildren(note);
        continue;
      }
      const target = Number(el.dataset.target);
      const prices = points.map((p) => Number(p[1]));
      let low = Math.min(...prices);
      let high = Math.max(...prices);
      if (Number.isFinite(target) && el.dataset.target !== "" && target >= low * 0.8 && target <= high * 1.2) {
        low = Math.min(low, target);
        high = Math.max(high, target);
      }
      const span = high - low || 1;
      const width = 200;
      const height = 40;
      const x = (i) => (i / (points.length - 1)) * width;
      const y = (v) => height - 3 - ((v - low) / span) * (height - 6);
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `From ${prices[0]} to ${prices[prices.length - 1]}, low ${Math.min(...prices)}`);
      const coords = prices.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      const area = document.createElementNS(ns, "polygon");
      area.setAttribute("points", `0,${height} ${coords.join(" ")} ${width},${height}`);
      area.setAttribute("fill", "currentColor");
      area.setAttribute("fill-opacity", "0.12");
      svg.appendChild(area);
      if (Number.isFinite(target) && el.dataset.target !== "" && target >= low && target <= high) {
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", "0");
        line.setAttribute("x2", String(width));
        line.setAttribute("y1", y(target).toFixed(1));
        line.setAttribute("y2", y(target).toFixed(1));
        line.setAttribute("stroke", "var(--td-ok)");
        line.setAttribute("stroke-dasharray", "4 3");
        line.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(line);
      }
      const path = document.createElementNS(ns, "polyline");
      path.setAttribute("points", coords.join(" "));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(path);
      el.replaceChildren(svg);
    }
  }

  /* ---------------- Wishlist: item sheet ---------------- */

  async _hOpenDetail(planId, itemId, focusLink = false) {
    const item = this._hItem(planId, itemId);
    if (!item) return;
    const d = { kind: "hoard-detail", planId, item, history: null, focusLink };
    this._openDialog(d);
    try {
      const res = await this._store.call({ type: "taskdragon/hoard_history", item_id: itemId, days: 365 });
      if (this._dialog === d) {
        d.history = res.points;
        this._renderDialog();
      }
    } catch (_err) {
      /* the sheet works without the history table */
    }
    if (focusLink) setTimeout(() => this.shadowRoot.querySelector("[data-hurl]")?.focus(), 60);
  }

  _hDetailHtml(d) {
    const hb = this._hData(d.planId);
    const item = d.item;
    const section = this._hSection(hb, item.section_id);
    const statuses = this._hStatusesFor(hb, item);
    const reached = statuses.findIndex(([key]) => key === item.status);
    const p = item.protection;
    const sorted = [...item.urls].sort((a, b) => (a.last_price ?? Infinity) - (b.last_price ?? Infinity));
    const sightings = (d.history || []).filter((h) => h.source !== "online").slice(-8).reverse();
    return html`<div class="ssheet-head">${this._hThumb(item, true)}
        <div class="grow" style="min-width:0"><h2>${item.title}</h2><div class="hsub">${this._hBadges(hb, item)}${section ? html`<span class="badge plan"><ha-icon icon="${section.icon || "mdi:tag-outline"}"></ha-icon>${section.name}</span>` : ""}</div>
          ${item.added_by && !item.mine ? html`<div class="lastdone">Added by ${item.added_by}</div>` : ""}</div>
        <button class="icon-btn" data-action="h-edit" data-id="${item.id}" title="Edit" aria-label="Edit"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>${this._closeButton()}</div>
      <div class="hblock"><h3>Status</h3><div class="hpipe-full" role="group" aria-label="Status">
        ${statuses.map(([key, label, icon], index) => html`<button class="${index < reached ? "done" : index === reached ? "on" : ""}" data-action="h-status" data-id="${item.id}" data-status="${key}" aria-pressed="${index === reached ? "true" : "false"}"><ha-icon icon="${icon}"></ha-icon>${label}</button>`)}
      </div></div>
      ${p ? html`<div class="hblock"><h3><ha-icon icon="mdi:shield-check-outline"></ha-icon>Price protection</h3>
          ${p.claim ? html`<div class="hnote-box claim"><ha-icon icon="mdi:cash-check"></ha-icon><span class="grow">💰 ${this._hMoney(p.claim.price, hb)} at ${p.claim.retailer} — ${this._hMoney(p.claim.savings, hb)} less than you paid ${p.days_since_purchase === 0 ? "today" : `${p.days_since_purchase} days ago`}. Claim your price adjustment!</span><a class="btn small" href="${p.claim.url}">Open</a></div>` : ""}
          <div class="hfacts"><span>Paid ${item.paid_price !== null ? this._hMoney(item.paid_price, hb) : "—"}${item.purchase_store ? ` at ${item.purchase_store}` : ""} on ${item.purchase_date}</span>
            <span class="${p.active ? "good" : ""}">${p.active ? `${p.days_left} of ${p.days} days left (until ${p.ends})` : `Window ended ${p.ends}`}</span></div></div>`
        : ""}
      <div class="hblock"><h3><ha-icon icon="mdi:storefront-outline"></ha-icon>Stores<span class="grow"></span>
          ${item.urls.length ? html`<button class="btn small flat" data-action="h-check" data-id="${item.id}"><ha-icon icon="mdi:refresh"></ha-icon>Check now</button>` : ""}</h3>
        ${item.urls.length ? html`<span class="hspark lg" data-spark="${JSON.stringify(item.sparkline)}" data-target="${item.target_price ?? ""}" aria-label="Price trend, last 30 days"></span>
          <div class="hfacts" style="margin:4px 0 6px">${item.target_price !== null ? html`<span class="${item.meets_target ? "good" : ""}">Target ${this._hMoney(item.target_price, hb)}</span>` : ""}
            ${item.average_price !== null ? html`<span>30-day average ${this._hMoney(item.average_price, hb)}</span>` : ""}
            ${item.below_average_pct > 0 ? html`<span class="good">Best is ${item.below_average_pct}% below average</span>` : ""}
            ${item.all_time_low !== null ? html`<span>Lowest seen ${this._hMoney(item.all_time_low, hb)}</span>` : ""}</div>` : html`<p class="hint">Paste a product page from any store to track its price. Big retailers sometimes block automatic checks; the card says so when that happens.</p>`}
        ${sorted.map((u) => this._hStoreRowHtml(hb, item, u))}
        <div class="hinline" style="margin-top:8px"><input data-hurl="${item.id}" type="url" inputmode="url" maxlength="2048" placeholder="https://store.example/product…" aria-label="Product page URL">
          <button class="btn small" data-action="h-url-add" data-id="${item.id}"><ha-icon icon="mdi:plus"></ha-icon>Add store</button>
          <button class="btn small flat" data-action="h-scan" data-plan="${d.planId}" data-item="${item.id}"><ha-icon icon="mdi:barcode-scan"></ha-icon>Scan</button></div>
      </div>
      ${item.watch_keyword_deals || item.deals.length
        ? html`<div class="hblock"><h3><ha-icon icon="mdi:fire"></ha-icon>Deal radar<span class="grow"></span>
            ${item.watch_keyword_deals ? html`<button class="btn small flat" data-action="h-deals-now" data-id="${item.id}">Search now</button>` : ""}</h3>
            <div class="lastdone">Searching Slickdeals and Reddit for “${item.deal_query || item.title}”${item.deal_max_price !== null ? ` up to ${this._hMoney(item.deal_max_price, hb)}` : item.target_price !== null ? ` up to ${this._hMoney(item.target_price, hb)}` : ""} · last searched ${this._hAgo(item.deals_checked_at)}</div>
            ${item.deals.length ? item.deals.map((deal) => this._hDealHtml(hb, deal)) : html`<div class="empty sm">No matching deals yet.</div>`}</div>`
        : ""}
      <div class="hblock"><h3><ha-icon icon="mdi:store"></ha-icon>Saw it in a store?</h3>
        <div class="hinline"><input data-hrecord="${item.id}" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Shelf price" aria-label="Shelf price">
          <input data-hrecord-store list="hoard-stores" maxlength="120" placeholder="Store" aria-label="Store">
          <button class="btn small flat" data-action="h-record" data-id="${item.id}">Save price</button></div>
        ${sightings.length ? html`<table class="hhist"><tbody>${sightings.map((h) => html`<tr><td>${String(h.checked_at).slice(0, 10)}</td><td>${h.source === "purchase" ? "Bought" : h.source === "in_store" ? "In store" : "Noted"}${h.store ? ` · ${h.store}` : ""}</td><td class="r">${this._hMoney(h.price, hb)}</td></tr>`)}</tbody></table>` : ""}
        <datalist id="hoard-stores">${(hb?.stores || []).map((s) => html`<option value="${s}"></option>`)}</datalist>
      </div>
      ${item.spec_notes ? html`<div class="hblock"><h3>Notes</h3><div style="white-space:pre-wrap">${item.spec_notes}</div></div>` : ""}
      ${item.hiding_spot || item.hiding_spot_locked ? html`<div class="hblock"><h3><ha-icon icon="mdi:archive-lock-outline"></ha-icon>Hiding spot</h3>
          ${item.hiding_spot_locked ? html`<div class="hint">This hiding spot was saved on another installation and can't be read here — edit the item to enter it again.</div>` : html`<div>${item.hiding_spot}</div>`}</div>` : ""}
      <div class="dialog-actions">
        <button class="btn flat danger-text" data-action="h-delete" data-id="${item.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>
        <span class="grow"></span>
        ${HOARD_OWNED.has(item.status) ? "" : html`<button class="btn flat" data-action="h-purchase" data-id="${item.id}"><ha-icon icon="mdi:cart-check"></ha-icon>Bought it</button>`}
        <button class="btn" data-action="h-edit" data-id="${item.id}"><ha-icon icon="mdi:pencil-outline"></ha-icon>Edit</button>
      </div>`;
  }

  _hStoreRowHtml(hb, item, u) {
    const isBest = item.best && item.best.url_id === u.id;
    return html`<div class="hstore-row">
      <span class="name"><a href="${u.url}">${u.retailer_name}</a></span>
      <span class="price ${isBest ? "best" : ""}">${u.last_price !== null ? this._hMoney(u.last_price, hb) : "—"}</span>
      <button class="icon-btn sm" data-action="h-url-del" data-id="${u.id}" title="Stop tracking this store" aria-label="Stop tracking ${u.retailer_name}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
      <span class="sub"><span class="dot ${u.in_stock === true ? "in" : u.in_stock === false ? "out" : ""}"></span>${u.in_stock === true ? "In stock" : u.in_stock === false ? "Out of stock" : "Stock unknown"}
        · checked ${this._hAgo(u.last_checked_at)}
        ${u.lowest_price !== null ? html` · low ${this._hMoney(u.lowest_price, hb)} / high ${this._hMoney(u.highest_price, hb)}` : ""}
        ${u.method ? html` · via ${{ jsonld: "product data", meta: "page tags", retailer: "store layout", custom: "your selector" }[u.method] || u.method}` : ""}
        ${u.last_error ? html`<span class="err">${u.last_error}</span>` : ""}</span>
      <details ${u.css_selector ? html`open` : ""}><summary>Custom price selector (advanced)</summary>
        <div class="hsel"><input data-hsel="${u.id}" value="${u.css_selector || ""}" maxlength="300" placeholder="e.g. .price-now or #price@data-value" aria-label="CSS selector for the price">
          <button class="btn small flat" data-action="h-url-sel" data-id="${u.id}">Save</button></div>
        <div class="lastdone">A CSS selector for the element holding the price; add @attribute to read an attribute instead of the text.</div></details>
    </div>`;
  }

  /* ---------------- Wishlist: add / edit ---------------- */

  _hNewItem(planId, extra = {}) {
    const hb = this._hData(planId);
    const ui = this._hUi();
    const section = ui.section !== "all" && ui.section !== "unsorted" ? ui.section : (hb?.sections.find((s) => s.kind === "want") || hb?.sections[0])?.id || "";
    return { id: null, plan_id: planId, title: "", section_id: section, priority: "none", status: "idea", target_price: null, spec_notes: "", gift_for_person_id: null, recipient_name: "", stealth_mode: false, hiding_spot: "", watch_keyword_deals: false, deal_query: "", deal_max_price: null, impulse_cooldown: false, barcode: "", brand: "", model: "", image_url: "", ...extra };
  }

  _hEditHtml(d) {
    const hb = this._hData(d.planId);
    const it = d.item;
    const people = hb?.people || this._board.people || [];
    const settings = hb?.settings || {};
    const section = this._hSection(hb, it.section_id);
    const giftish = section?.is_gift;
    const statuses = giftish || it.gift_for_person_id ? HOARD_STATUSES : HOARD_STATUSES.filter(([k]) => HOARD_WANT_STATUSES.includes(k));
    const cooldownAllowed = !giftish && (it.cooldown_eligible !== false || it.impulse_cooldown);
    const num = (v) => (v === null || v === undefined ? "" : v);
    return html`<h2><span class="grow">${it.id ? "Edit item" : "Add to the wishlist"}</span>${this._closeButton()}</h2>
      <div class="form hform">
        <label class="full">Name<input name="title" value="${it.title}" maxlength="200" placeholder="4k monitor, cordless router, toddler rain boots…" autofocus></label>
        <label>Section<select name="section_id"><option value="">Unsorted</option>${this._hTop(hb).map(
          (s) => html`<option value="${s.id}" ${s.id === it.section_id ? html`selected` : ""}>${s.name}</option>${this._hChildren(hb, s.id).map(
            (c) => html`<option value="${c.id}" ${c.id === it.section_id ? html`selected` : ""}>${s.name} › ${c.name}</option>`,
          )}`,
        )}</select></label>
        <label>Status<select name="status">${statuses.map(([k, l]) => html`<option value="${k}" ${k === it.status ? html`selected` : ""}>${l}</option>`)}</select></label>
        <label>Target price<input name="target_price" type="number" min="0" step="0.01" inputmode="decimal" value="${num(it.target_price)}" placeholder="e.g. 300"></label>
        <label>Priority<select name="priority">${PRIORITIES.map((p) => html`<option value="${p}" ${p === it.priority ? html`selected` : ""}>${p}</option>`)}</select></label>
        <label class="full">Spec notes<textarea name="spec_notes" maxlength="2000" placeholder="27-inch+, IPS or OLED, USB-C PD…">${it.spec_notes || ""}</textarea></label>
        ${it.id ? "" : html`<label class="full">Store link (optional)<input name="first_url" type="url" inputmode="url" maxlength="2048" placeholder="Paste a product page to track its price now"></label>`}
      </div>
      <div class="hblock"><h3><ha-icon icon="mdi:gift-outline"></ha-icon>Gift & privacy</h3>
        <div class="form">
          <label>Gift for<select name="gift_for_person_id"><option value="">Nobody in particular</option>${people.map((p) => html`<option value="${p.entity_id}" ${p.entity_id === it.gift_for_person_id ? html`selected` : ""}>${p.name}</option>`)}</select></label>
          <label>…or someone else<input name="recipient_name" value="${it.recipient_name || ""}" maxlength="120" placeholder="Grandma, teacher…"></label>
          <label class="inline full"><input type="checkbox" name="stealth_mode" ${it.stealth_mode ? html`checked` : ""}> <ha-icon icon="mdi:incognito"></ha-icon>Keep it secret: only I can see this item</label>
          <label class="full">Hiding spot (encrypted, only shown to people who can see this item)<input name="hiding_spot" value="${it.hiding_spot || ""}" maxlength="500" placeholder="Top shelf of the pole barn, tote #4"></label>
        </div>
        <p class="hint" style="margin-top:8px">The person a gift is for never sees it — on their own login it shows as “🐉 secret gift”. Wall tablets in kiosk mode cover secret gifts until someone taps Show. Administrators who download a TaskDragon backup or open Home Assistant's files can still see everything.</p>
      </div>
      <div class="hblock"><h3><ha-icon icon="mdi:fire"></ha-icon>Deal radar</h3>
        <div class="form">
          <label class="inline full"><input type="checkbox" name="watch_keyword_deals" ${it.watch_keyword_deals ? html`checked` : ""}> Watch public deal posts (Slickdeals, Reddit) for this</label>
          <label>Search words<input name="deal_query" value="${it.deal_query || ""}" maxlength="120" placeholder="${it.title || "4k monitor"}"></label>
          <label>Max price<input name="deal_max_price" type="number" min="0" step="0.01" inputmode="decimal" value="${num(it.deal_max_price)}" placeholder="target price"></label>
        </div>
      </div>
      ${cooldownAllowed ? html`<div class="hblock"><label class="inline"><input type="checkbox" name="impulse_cooldown" ${it.impulse_cooldown ? html`checked` : ""}> <ha-icon icon="mdi:timer-sand-full"></ha-icon>${settings.impulse_days || 7}-day impulse cooldown${settings.impulse_threshold ? ` (for things over ${this._hMoney(settings.impulse_threshold, hb)})` : ""}</label></div>` : ""}
      <details class="hblock"><summary>Product details</summary>
        <div class="form" style="margin-top:8px">
          <label>Brand<input name="brand" value="${it.brand || ""}" maxlength="120"></label>
          <label>Model<input name="model" value="${it.model || ""}" maxlength="120"></label>
          <label>Barcode (UPC/EAN)<input name="barcode" value="${it.barcode_display || it.barcode || ""}" maxlength="64" inputmode="numeric"></label>
          <label>Photo URL (https)<input name="image_url" value="${it.image_url || ""}" maxlength="2048" inputmode="url"></label>
        </div></details>
      <div class="dialog-actions"><span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="h-save" ${d.busy ? html`disabled` : ""}>${it.id ? "Save" : "Add"}</button></div>`;
  }

  _hFormValues(root = this.shadowRoot.querySelector(".dialog")) {
    const out = {};
    for (const el of root?.querySelectorAll("[name]") || []) {
      if (el.type === "checkbox") out[el.name] = el.checked;
      else out[el.name] = el.value;
    }
    return out;
  }

  async _hSave() {
    const d = this._dialog;
    if (d?.kind !== "hoard-edit" || d.busy) return;
    const v = this._hFormValues();
    const title = (v.title || "").trim();
    if (!title) return this._showToast("Give it a name, like 4k monitor");
    const numOrNull = (x) => (x === "" || x === undefined ? null : Number(x));
    const item = {
      title,
      section_id: v.section_id || null,
      status: v.status,
      priority: v.priority,
      target_price: numOrNull(v.target_price),
      spec_notes: v.spec_notes || null,
      gift_for_person_id: v.gift_for_person_id || null,
      recipient_name: v.recipient_name || null,
      stealth_mode: !!v.stealth_mode,
      hiding_spot: v.hiding_spot || null,
      watch_keyword_deals: !!v.watch_keyword_deals,
      deal_query: v.deal_query || null,
      deal_max_price: numOrNull(v.deal_max_price),
      brand: v.brand || null,
      model: v.model || null,
      barcode: v.barcode || null,
      image_url: v.image_url || null,
    };
    if (v.impulse_cooldown !== undefined) item.impulse_cooldown = !!v.impulse_cooldown;
    if (d.item.id) item.id = d.item.id;
    else item.plan_id = d.planId;
    d.busy = true;
    let saved;
    try {
      saved = await this._call({ type: "taskdragon/hoard_save_item", item });
      if (!d.item.id && (v.first_url || "").trim()) saved = await this._call({ type: "taskdragon/hoard_add_url", item_id: saved.id, url: v.first_url.trim() });
    } catch (_err) {
      d.busy = false;
      if (this._dialog === d) this._renderDialog();
      return;
    }
    this._hPut(saved);
    if (d.item.id) this._hOpenDetail(d.planId, saved.id);
    else {
      this._closeDialog();
      this._showToast(`Added ${saved.title}`);
    }
  }

  async _hQuickAdd(planId) {
    const input = this.shadowRoot.querySelector(`[data-hoard-input="${CSS.escape(planId)}"]`);
    const title = input?.value.trim();
    if (!title) return;
    const item = this._hNewItem(planId);
    try {
      const saved = await this._call({ type: "taskdragon/hoard_save_item", item: { plan_id: planId, title, section_id: item.section_id || null } });
      input.value = "";
      this._hPut(saved);
      this._showToast(`Added ${saved.title} as a concept tag — link a store or turn on the deal radar any time`);
    } catch (_err) {
      /* reported by _call */
    }
  }

  /* ---------------- Wishlist: purchase ---------------- */

  _hPurchaseHtml(d) {
    const hb = this._hData(d.planId);
    const it = d.item;
    const days = hb?.settings?.protection_days || 30;
    const choices = HOARD_PROTECTION.some(([n]) => n === days) ? HOARD_PROTECTION : [[days, `${days} days`], ...HOARD_PROTECTION];
    return html`<h2><span class="grow">Bought “${it.title}”</span>${this._closeButton()}</h2>
      <p class="hint">TaskDragon keeps checking the stores during the return window and alerts you if the price drops below what you paid.</p>
      <div class="form">
        <label>Price paid<input name="paid_price" type="number" min="0" step="0.01" inputmode="decimal" value="${it.best?.price ?? ""}" autofocus></label>
        <label>Date<input name="purchase_date" type="date" value="${this._today()}"></label>
        <label>Store<input name="store" list="hoard-stores-p" value="${it.best?.retailer || ""}" maxlength="120"></label>
        <label>Price protection<select name="protection_days">${choices.map(([n, l]) => html`<option value="${n}" ${n === days ? html`selected` : ""}>${l}</option>`)}</select></label>
      </div>
      <datalist id="hoard-stores-p">${(hb?.stores || []).map((s) => html`<option value="${s}"></option>`)}</datalist>
      <div class="dialog-actions"><span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="h-purchase-save"><ha-icon icon="mdi:cart-check"></ha-icon>Mark purchased</button></div>`;
  }

  async _hPurchaseSave() {
    const d = this._dialog;
    if (d?.kind !== "hoard-purchase") return;
    const v = this._hFormValues();
    const res = await this._call({
      type: "taskdragon/hoard_mark_purchased",
      item_id: d.item.id,
      paid_price: v.paid_price === "" ? null : Number(v.paid_price),
      purchase_date: v.purchase_date || null,
      store: v.store || null,
      protection_days: Number(v.protection_days),
    });
    this._closeDialog();
    this._hPut(res);
    this._showToast(res.protection?.active ? `Marked purchased — watching for price drops for ${res.protection.days_left} days` : "Marked purchased");
  }

  /* ---------------- Wishlist: sections ---------------- */

  _hSectionHtml(d) {
    const hb = this._hData(d.planId);
    const s = d.section;
    const people = hb?.people || this._board.people || [];
    const parent = s.parent_id ? this._hSection(hb, s.parent_id) : null;
    if (parent) return this._hCategoryHtml(d, s, parent, people);
    const gift = s.kind !== "want";
    return html`<h2><span class="grow">${s.id ? "Edit section" : "New occasion section"}</span>${this._closeButton()}</h2>
      <div class="form">
        <label class="full">Name<input name="name" value="${s.name || ""}" maxlength="120" placeholder="Christmas, Alex's birthday, Black Friday…" autofocus></label>
        <label>Type<select name="kind">${HOARD_KINDS.map(([k, l]) => html`<option value="${k}" ${k === s.kind ? html`selected` : ""}>${l}</option>`)}</select></label>
        <label>Icon<select name="icon">${HOARD_SECTION_ICONS.map((icon) => html`<option value="${icon}" ${icon === s.icon ? html`selected` : ""}>${icon.replace("mdi:", "").replace(/-/g, " ")}</option>`)}</select></label>
        <label>Budget<input name="budget" type="number" min="0" step="1" inputmode="decimal" value="${s.budget ?? ""}" placeholder="e.g. 1000"></label>
        <label>Date<input name="event_date" type="date" value="${s.event_date || ""}"></label>
        <label class="inline full"><input type="checkbox" name="repeats_yearly" ${s.repeats_yearly ? html`checked` : ""}> Every year (count down to the next one)</label>
        ${gift ? html`<label>For<select name="gift_for_person_id"><option value="">Several people</option>${people.map((p) => html`<option value="${p.entity_id}" ${p.entity_id === s.gift_for_person_id ? html`selected` : ""}>${p.name}</option>`)}</select></label>
          <label>…or someone else<input name="recipient_name" value="${s.recipient_name || ""}" maxlength="120"></label>` : ""}
        <label class="inline full"><input type="checkbox" name="stealth_mode" ${s.stealth_mode ? html`checked` : ""}> <ha-icon icon="mdi:incognito"></ha-icon>Secret section: only I can see it and what's in it</label>
      </div>
      ${gift ? html`<p class="hint" style="margin-top:8px">A section for one person is hidden from that person entirely.</p>` : ""}
      <div class="dialog-actions">
        ${s.id ? html`<button class="btn flat" data-action="h-section-delete" data-id="${s.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        <span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="h-section-save">${s.id ? "Save" : "Create"}</button></div>`;
  }

  /** A category of an occasion: usually a person (Christmas → Ellie), or a group like Stocking stuffers. */
  _hCategoryHtml(d, s, parent, people) {
    const gift = parent.is_gift;
    return html`<h2><span class="grow">${s.id ? `Edit “${s.name}”` : `New ${gift ? "list" : "category"} in ${parent.name}`}</span>${this._closeButton()}</h2>
      <div class="form">
        <label class="full">Name<input name="name" value="${s.name || ""}" maxlength="120" placeholder="${gift ? "Ellie, Grandma, Stocking stuffers…" : "Tools, Kitchen, Garden…"}" autofocus></label>
        ${gift ? html`<label>Household member<select name="gift_for_person_id"><option value="">Someone else / a group</option>${people.map((p) => html`<option value="${p.entity_id}" ${p.entity_id === s.gift_for_person_id ? html`selected` : ""}>${p.name}</option>`)}</select></label>` : ""}
        <label>Budget<input name="budget" type="number" min="0" step="1" inputmode="decimal" value="${s.budget ?? ""}" placeholder="optional"></label>
        <label class="inline full"><input type="checkbox" name="stealth_mode" ${s.stealth_mode ? html`checked` : ""}> <ha-icon icon="mdi:incognito"></ha-icon>Secret: only I can see this ${gift ? "list" : "category"}</label>
      </div>
      ${gift ? html`<p class="hint" style="margin-top:8px">Pick the household member it's for and they won't see this list or anything in it. Everything here counts as a gift, so wall tablets cover it until someone taps Show.</p>` : ""}
      <div class="dialog-actions">
        ${s.id ? html`<button class="btn flat" data-action="h-section-delete" data-id="${s.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        <span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="h-section-save">${s.id ? "Save" : "Add"}</button></div>`;
  }

  async _hSectionSave() {
    const d = this._dialog;
    if (d?.kind !== "hoard-section") return;
    const v = this._hFormValues();
    const name = (v.name || "").trim();
    if (!name) return this._showToast(d.section.parent_id ? "Give it a name, like Ellie" : "Give the section a name");
    if (d.section.parent_id) {
      const category = { name, budget: v.budget === "" || v.budget === undefined ? null : Number(v.budget), stealth_mode: !!v.stealth_mode };
      if (v.gift_for_person_id !== undefined) category.gift_for_person_id = v.gift_for_person_id || null;
      if (d.section.id) category.id = d.section.id;
      else Object.assign(category, { plan_id: d.planId, parent_id: d.section.parent_id });
      await this._call({ type: "taskdragon/hoard_save_section", section: category });
      this._closeDialog();
      this._hUi().section = d.section.parent_id;
      await this._loadHoard(d.planId);
      return;
    }
    const section = {
      name,
      kind: v.kind,
      icon: v.icon || null,
      budget: v.budget === "" ? null : Number(v.budget),
      event_date: v.event_date || null,
      repeats_yearly: !!v.repeats_yearly,
      stealth_mode: !!v.stealth_mode,
      gift_for_person_id: v.gift_for_person_id || null,
      recipient_name: v.recipient_name || null,
    };
    if (d.section.id) section.id = d.section.id;
    else section.plan_id = d.planId;
    const saved = await this._call({ type: "taskdragon/hoard_save_section", section });
    this._closeDialog();
    this._hUi().section = saved.id;
    await this._loadHoard(d.planId);
  }

  /* ---------------- Wishlist: in-store scan & price check ---------------- */

  async _hScanLookup(code, format, ctx) {
    let res;
    try {
      const message = { type: "taskdragon/scan_price_check", barcode: code };
      if (format && SCAN_FORMATS.includes(format)) message.format = format;
      if (ctx.planId) message.plan_id = ctx.planId;
      res = await this._store.call(message);
    } catch (err) {
      return this._fail(err);
    }
    const local = ctx.itemId ? res.local.find((i) => i.id === ctx.itemId) || null : res.local[0] || null;
    const want = res.sections.find((s) => s.kind === "want");
    const giftSection = res.sections.find((s) => s.kind !== "want");
    this._openDialog({
      kind: "hoard-scan",
      res,
      itemId: ctx.itemId || local?.id || null,
      local,
      shelf: "",
      store: "",
      title: res.product?.title || local?.title || "",
      gift: false,
      giftSection: giftSection?.id || "",
      wantSection: want?.id || "",
      giftFor: "",
      recipient: "",
      secret: true,
      busy: false,
    });
  }

  _hVerdict(d) {
    const best = d.res.best_online;
    const shelf = Number(d.shelf);
    const hb = this._hData(d.res.plan_id);
    if (!(shelf > 0)) return { cls: "idle", text: best ? `Lowest online: ${this._hMoney(best.price, hb)} at ${best.retailer}. Type the shelf price to compare.` : "Type the shelf price you see to keep a record of it." };
    if (!best) return { cls: "idle", text: "No online price recorded for this product — use the search links below to compare." };
    const diff = Math.round((best.price - shelf) * 100) / 100;
    if (diff >= 0) return { cls: "buy", text: diff === 0 ? "✅ BUY HERE — Same as the lowest online price" : `✅ BUY HERE — Beats lowest online price by ${this._hMoney(diff, hb)}` };
    return { cls: "online", text: `⚠️ CHEAPER ONLINE — Save ${this._hMoney(-diff, hb)} at ${best.retailer}` };
  }

  _hVerdictHtml(d) {
    const v = this._hVerdict(d);
    return html`<div class="hverdict ${v.cls}" aria-live="polite">${v.text}</div>`;
  }

  _hScanHtml(d) {
    const res = d.res;
    const product = res.product;
    const hb = this._hData(res.plan_id);
    const people = res.people || [];
    const note = {
      not_found: "No product database knows this code yet — give it a name below.",
      limit: "The free UPC lookup allowance is used up for today; the search links still work.",
      error: "The product database couldn't be reached.",
      disabled: "Product lookups are off in the price tracker settings.",
      not_retail: "This isn't a retail product code.",
    }[res.lookup];
    const image = { tier: "tracked", title: product?.title || d.title };
    const stores = [...new Set([...(res.stores || []), ...(hb?.stores || [])])];
    const giftSections = res.sections.filter((s) => s.kind !== "want");
    return html`<div class="ssheet-head">${this._hThumb(image, true)}
        <div class="grow" style="min-width:0">
          ${product ? html`<h2>${product.title}</h2><div class="lastdone">${[product.brand, product.model, product.source ? `via ${product.source}` : ""].filter(Boolean).join(" · ")}</div>` : html`<h2>Unknown product</h2>`}
          <div class="scode" style="margin-top:6px"><ha-icon icon="mdi:barcode"></ha-icon><code>${res.display}</code>${d.local ? html`<span class="badge ok">On your list: ${d.local.title}</span>` : ""}</div>
        </div>${this._closeButton()}</div>
      ${note && !product ? html`<div class="hint" style="margin-top:8px">${note}</div>` : note && res.lookup === "limit" ? html`<div class="hint" style="margin-top:8px">${note}</div>` : ""}
      ${!product && !d.local ? html`<label style="display:flex;flex-direction:column;gap:4px;font-size:.8rem;color:var(--td-muted);margin-top:10px">Name<input data-hscan-title value="${d.title}" maxlength="200" placeholder="What is it?"></label>` : ""}
      <div class="hshelf">
        <label>Shelf price you see right now<input class="big" data-hshelf type="number" min="0" step="0.01" inputmode="decimal" value="${d.shelf}" placeholder="0.00" autofocus></label>
        <label>Store you're in<input data-hstore list="hoard-scan-stores" value="${d.store}" maxlength="120" placeholder="Target, Costco…"></label>
      </div>
      <datalist id="hoard-scan-stores">${stores.map((s) => html`<option value="${s}"></option>`)}</datalist>
      <div class="hverdict-host">${this._hVerdictHtml(d)}</div>
      <div class="honline">
        ${res.online.length
          ? res.online.slice(0, 8).map(
              (o) => html`<div class="hstore-row"><span class="name"><a href="${o.url}">${o.retailer}</a></span><span class="price ${res.best_online && o.url === res.best_online.url && o.price === res.best_online.price ? "best" : ""}">${this._hMoney(o.price, hb)}</span><span></span>
                <span class="sub"><span class="dot ${o.in_stock === true ? "in" : o.in_stock === false ? "out" : ""}"></span>${o.source === "tracked" ? "Tracked by you" : "Recorded online offer"}${o.updated_at ? ` · ${this._hAgo(o.updated_at)}` : ""}</span></div>`,
            )
          : html`<div class="empty sm">No online prices recorded for this code.</div>`}
      </div>
      <div class="hlinks">${res.search_links.map((l) => html`<a class="chip" href="${l.url}"><ha-icon icon="mdi:open-in-new"></ha-icon>${l.name}</a>`)}</div>
      ${(res.model_links || []).length
        ? html`<details class="hmodel"><summary>Search by model number (${product.model})</summary>
            <div class="hlinks">${res.model_links.map((l) => html`<a class="chip" href="${l.url}"><ha-icon icon="mdi:open-in-new"></ha-icon>${l.name}</a>`)}</div></details>`
        : ""}
      <div class="sactions" style="margin-top:14px">
        <button class="btn sbig" data-action="h-scan-add" ${d.busy ? html`disabled` : ""}><ha-icon icon="mdi:plus"></ha-icon>${d.local ? "Update & track price" : "Add to Want to Buy & track"}</button>
        <button class="btn flat" data-action="h-scan-gift" aria-expanded="${d.gift ? "true" : "false"}" ${giftSections.length ? "" : html`disabled`}><ha-icon icon="mdi:gift-outline"></ha-icon>Add to a gift list</button>
        <button class="btn flat" data-action="h-scan-bought" ${d.busy ? html`disabled` : ""} style="grid-column:1 / -1"><ha-icon icon="mdi:check"></ha-icon>Bought it here</button>
      </div>
      ${d.gift
        ? html`<div class="hgift"><div class="form">
            <label>Gift list<select data-hscan-gsec>${giftSections.map((s) => html`<option value="${s.id}" ${s.id === d.giftSection ? html`selected` : ""}>${s.name}</option>`)}</select></label>
            <label>For<select data-hscan-gfor><option value="">—</option>${people.map((p) => html`<option value="${p.entity_id}" ${p.entity_id === d.giftFor ? html`selected` : ""}>${p.name}</option>`)}</select></label>
            <label class="full">…or someone else<input data-hscan-grec value="${d.recipient}" maxlength="120"></label>
            <label class="inline full"><input type="checkbox" data-hscan-gsecret ${d.secret ? html`checked` : ""}> <ha-icon icon="mdi:incognito"></ha-icon>Stealth: only I can see it</label>
          </div>
          <div class="dialog-actions" style="margin-top:10px"><span class="grow"></span><button class="btn" data-action="h-scan-gift-save" ${d.busy ? html`disabled` : ""}><ha-icon icon="mdi:gift-outline"></ha-icon>Add gift</button></div></div>`
        : ""}`;
  }

  _hScanSync() {
    const d = this._dialog;
    if (d?.kind !== "hoard-scan") return;
    const q = (sel) => this.shadowRoot.querySelector(`.dialog ${sel}`);
    if (q("[data-hshelf]")) d.shelf = q("[data-hshelf]").value;
    if (q("[data-hstore]")) d.store = q("[data-hstore]").value;
    if (q("[data-hscan-title]")) d.title = q("[data-hscan-title]").value;
    if (q("[data-hscan-gsec]")) d.giftSection = q("[data-hscan-gsec]").value;
    if (q("[data-hscan-gfor]")) d.giftFor = q("[data-hscan-gfor]").value;
    if (q("[data-hscan-grec]")) d.recipient = q("[data-hscan-grec]").value;
    if (q("[data-hscan-gsecret]")) d.secret = q("[data-hscan-gsecret]").checked;
  }

  async _hScanSave(mode) {
    this._hScanSync();
    const d = this._dialog;
    if (d?.kind !== "hoard-scan" || d.busy) return;
    const res = d.res;
    const title = (res.product?.title || d.local?.title || d.title || "").trim();
    if (!d.itemId && !title) return this._showToast("Give the product a name first");
    const shelf = Number(d.shelf);
    if (mode === "bought" && !(shelf > 0)) return this._showToast("Enter the shelf price you paid");
    const message = { type: "taskdragon/hoard_add_from_scan", plan_id: res.plan_id, barcode: res.barcode, store: d.store.trim() || null };
    if (shelf > 0) message.shelf_price = shelf;
    if (d.itemId) message.item_id = d.itemId;
    else message.title = title;
    // For an item already on the list these only fill in what it's missing.
    if (res.product?.brand) message.brand = res.product.brand;
    if (res.product?.model) message.model = res.product.model;
    if (res.product?.image) message.image_url = res.product.image;
    const offers = res.online.filter((o) => o.source === "upcitemdb").slice(0, 6).map((o) => ({ url: o.url, retailer_name: o.retailer }));
    if (offers.length) message.offers = offers;
    if (mode === "gift") {
      message.section_id = d.giftSection || null;
      if (d.giftFor) message.gift_for_person_id = d.giftFor;
      if (d.recipient.trim()) message.recipient_name = d.recipient.trim();
      message.stealth_mode = !!d.secret;
    } else if (!d.itemId && d.wantSection) message.section_id = d.wantSection;
    if (mode === "bought") message.bought = true;
    d.busy = true;
    this._renderDialog();
    let saved;
    try {
      saved = await this._call(message);
    } catch (_err) {
      d.busy = false;
      if (this._dialog === d) this._renderDialog();
      return;
    }
    this._closeDialog();
    this._hPut(saved);
    if (mode === "bought") this._showToast(saved.protection?.active ? `Bought ${saved.title} — price protection on for ${saved.protection.days_left} days` : `Bought ${saved.title}`);
    else if (mode === "gift") this._showToast(`Added ${saved.title} to the gift list${saved.stealth_mode ? " (secret)" : ""}`);
    else this._showToast(`Tracking ${saved.title}${saved.urls.length ? ` at ${saved.urls.length} ${saved.urls.length === 1 ? "store" : "stores"}` : ""}`);
    this._loadHoard(saved.plan_id);
  }

  /* ---------------- Wishlist: tracker settings ---------------- */

  async _hSettingsOpen() {
    const planId = this._hPlanId();
    let settings;
    try {
      settings = await this._store.call({ type: "taskdragon/hoard_settings" });
    } catch (err) {
      return this._fail(err);
    }
    this._openDialog({ kind: "hoard-settings", planId, settings });
  }

  _hSettingsHtml(d) {
    const s = d.settings;
    const admin = this._isAdmin();
    const off = admin ? "" : html`disabled`;
    return html`<h2><span class="grow">Price tracker</span>${this._closeButton()}</h2>
      ${admin ? "" : html`<div class="hint">Only administrators can change these.</div>`}
      <div class="form">
        <label class="inline full"><input type="checkbox" name="tracking" ${s.tracking ? html`checked` : ""} ${off}> Check store prices automatically</label>
        <label>Every (hours)<input name="check_hours" type="number" min="1" max="168" value="${s.check_hours}" ${off}></label>
        <label>Price protection (days)<input name="protection_days" type="number" min="1" max="180" value="${s.protection_days}" ${off}></label>
        <label class="inline full"><input type="checkbox" name="deal_radar" ${s.deal_radar ? html`checked` : ""} ${off}> Deal radar (Slickdeals and Reddit searches for concept tags)</label>
        <label>Search every (hours)<input name="deal_hours" type="number" min="1" max="168" value="${s.deal_hours}" ${off}></label>
        <label class="inline full"><input type="checkbox" name="upc_lookup" ${s.upc_lookup ? html`checked` : ""} ${off}> Look up scanned barcodes on UPCitemdb (about 100 free lookups a day)</label>
        <label>Impulse cooldown from<input name="impulse_threshold" type="number" min="0" step="1" value="${s.impulse_threshold}" ${off}></label>
        <label>Cooldown length (days)<input name="impulse_days" type="number" min="1" max="60" value="${s.impulse_days}" ${off}></label>
      </div>
      <p class="hint" style="margin-top:10px">Only product page addresses, deal search words and barcode digits leave Home Assistant. Addresses on your own network are never fetched.</p>
      <div class="dialog-actions"><span class="grow"></span><button class="btn flat" data-action="dialog-close">Close</button>
        ${admin ? html`<button class="btn" data-action="h-settings-save">Save</button>` : ""}</div>`;
  }

  async _hSettingsSave() {
    const d = this._dialog;
    if (d?.kind !== "hoard-settings") return;
    const v = this._hFormValues();
    const settings = {
      tracking: !!v.tracking,
      check_hours: Number(v.check_hours),
      deal_radar: !!v.deal_radar,
      deal_hours: Number(v.deal_hours),
      upc_lookup: !!v.upc_lookup,
      impulse_threshold: Number(v.impulse_threshold),
      impulse_days: Number(v.impulse_days),
      protection_days: Number(v.protection_days),
    };
    await this._call({ type: "taskdragon/hoard_settings", settings });
    this._closeDialog();
    this._showToast("Price tracker settings saved");
    if (d.planId) this._loadHoard(d.planId);
  }

  /* ---------------- Wishlist: actions ---------------- */

  async _hoardAction(action, el) {
    const id = el.dataset.id;
    const planId = this._hPlanId() || this._dialog?.planId || this._dialog?.res?.plan_id;
    const ui = this._hUi();
    switch (action) {
      case "h-retry":
        this._hoardError = null;
        return this._loadHoard(id);
      case "h-section":
        ui.section = id;
        return this._renderBody();
      case "h-new-section":
        return this._openDialog({ kind: "hoard-section", planId, section: { kind: "holiday", icon: "mdi:calendar-star", repeats_yearly: true } });
      case "h-new-category": {
        const parent = this._hSection(this._hData(planId), id);
        if (parent) this._openDialog({ kind: "hoard-section", planId, section: { parent_id: parent.id, kind: parent.kind } });
        return;
      }
      case "h-edit-section": {
        const section = this._hSection(this._hData(planId), id);
        if (section) this._openDialog({ kind: "hoard-section", planId, section: { ...section } });
        return;
      }
      case "h-section-save":
        return this._hSectionSave();
      case "h-section-delete": {
        const hb = this._hData(planId);
        const doomed = this._hSection(hb, id);
        const parent = doomed?.parent_id ? this._hSection(hb, doomed.parent_id) : null;
        const kids = this._hChildren(hb, id).length;
        const question = parent
          ? `Delete “${doomed.name}”? Its items move up to ${parent.name}.`
          : kids
            ? `Delete this section and its ${kids} ${kids === 1 ? "category" : "categories"}? Their items move to Unsorted.`
            : "Delete this section? Its items move to Unsorted.";
        if (!confirm(question)) return;
        await this._call({ type: "taskdragon/hoard_delete_section", section_id: id });
        this._closeDialog();
        ui.section = parent ? parent.id : "all";
        return this._loadHoard(planId);
      }
      case "h-open":
        return this._hOpenDetail(planId, id, !!el.dataset.focusLink);
      case "h-add": {
        const target = el.dataset.plan || planId;
        return this._openDialog({ kind: "hoard-edit", planId: target, item: this._hNewItem(target, el.dataset.section ? { section_id: el.dataset.section } : {}) });
      }
      case "h-edit": {
        const item = this._hItem(planId, id);
        if (item) this._openDialog({ kind: "hoard-edit", planId, item: { ...item } });
        return;
      }
      case "h-save":
        return this._hSave();
      case "h-next": {
        const item = this._hItem(planId, id);
        const next = item && this._hNextStatus(this._hData(planId), item);
        if (!next) return;
        const res = await this._call({ type: "taskdragon/hoard_set_status", item_id: id, status: next });
        this._hPut(res);
        return this._showToast(`${res.title}: ${this._hStatus(next)[1]}${next === "stashed" && !res.hiding_spot ? " — add the hiding spot so you don't forget" : ""}`, null, next === "stashed" && !res.hiding_spot ? [{ label: "Add hiding spot", run: () => this._openDialog({ kind: "hoard-edit", planId, item: { ...res } }) }] : []);
      }
      case "h-status": {
        const status = el.dataset.status;
        const item = this._hItem(planId, id);
        if (!item || item.status === status) return;
        if (status === "purchased" && !HOARD_OWNED.has(item.status)) return this._openDialog({ kind: "hoard-purchase", planId, item });
        return this._hPut(await this._call({ type: "taskdragon/hoard_set_status", item_id: id, status }));
      }
      case "h-purchase": {
        const item = this._hItem(planId, id);
        if (item) this._openDialog({ kind: "hoard-purchase", planId, item });
        return;
      }
      case "h-purchase-save":
        return this._hPurchaseSave();
      case "h-check": {
        el.disabled = true;
        try {
          const res = await this._call({ type: "taskdragon/hoard_check_now", item_id: id });
          this._hPut(res);
          const errors = res.urls.filter((u) => u.last_error).length;
          this._showToast(res.best ? `Best now: ${this._hMoney(res.best.price)} at ${res.best.retailer}${errors ? ` (${errors} store${errors === 1 ? "" : "s"} couldn't be read)` : ""}` : "No price found yet — open the item to see why");
        } finally {
          el.disabled = false;
        }
        return;
      }
      case "h-delete": {
        const res = await this._call({ type: "taskdragon/hoard_delete_item", item_id: id });
        this._closeDialog();
        const hb = this._hData(planId);
        if (hb) hb.items = hb.items.filter((i) => i.id !== id);
        this._renderBody();
        return this._showToast("Item deleted", this._undoWith(res.undo));
      }
      case "h-url-add": {
        const input = this.shadowRoot.querySelector(`[data-hurl="${CSS.escape(id)}"]`);
        const url = input?.value.trim();
        if (!url) return this._showToast("Paste a product page address first");
        const res = await this._call({ type: "taskdragon/hoard_add_url", item_id: id, url });
        this._hPut(res);
        this._showToast("Store added — checking its price…");
        setTimeout(() => this._loadHoard(res.plan_id), 12000);
        return;
      }
      case "h-url-del": {
        if (!confirm("Stop tracking this store?")) return;
        return this._hPut(await this._call({ type: "taskdragon/hoard_delete_url", url_id: id }));
      }
      case "h-url-sel": {
        const value = this.shadowRoot.querySelector(`[data-hsel="${CSS.escape(id)}"]`)?.value.trim() || null;
        const res = await this._call({ type: "taskdragon/hoard_update_url", url_id: id, css_selector: value });
        this._hPut(res);
        this._showToast(value ? "Selector saved — checking the page again…" : "Selector removed");
        setTimeout(() => this._loadHoard(res.plan_id), 12000);
        return;
      }
      case "h-record": {
        const price = Number(this.shadowRoot.querySelector(`[data-hrecord="${CSS.escape(id)}"]`)?.value);
        const store = this.shadowRoot.querySelector("[data-hrecord-store]")?.value.trim() || null;
        if (!(price > 0)) return this._showToast("Enter the price you saw");
        const res = await this._call({ type: "taskdragon/hoard_record_price", item_id: id, price, store, source: "in_store" });
        this._hPut(res);
        return this._hOpenDetail(res.plan_id, res.id);
      }
      case "h-deal-promote": {
        const res = await this._call({ type: "taskdragon/hoard_deal_action", deal_id: id, action: "promote" });
        this._hPut(res);
        return this._showToast("Tracking that deal's price");
      }
      case "h-deal-dismiss":
        return this._hPut(await this._call({ type: "taskdragon/hoard_deal_action", deal_id: id, action: "dismiss" }));
      case "h-deals-now": {
        el.disabled = true;
        try {
          const res = await this._call({ type: "taskdragon/hoard_check_deals", item_id: id });
          this._hPut(res);
          this._showToast(res.deals.length ? `${res.deals.length} matching deals` : "No matching deals right now");
        } finally {
          el.disabled = false;
        }
        return;
      }
      case "h-scan":
        if (this._dialog?.kind === "hoard-detail") this._closeDialog();
        return this._scanOpen("hoard", { planId: el.dataset.plan || planId, itemId: el.dataset.item || null });
      case "h-scan-add":
        return this._hScanSave("want");
      case "h-scan-bought":
        return this._hScanSave("bought");
      case "h-scan-gift":
        this._hScanSync();
        this._dialog.gift = !this._dialog.gift;
        return this._renderDialog();
      case "h-scan-gift-save":
        return this._hScanSave("gift");
      case "h-reveal": {
        ui.revealed.add(id);
        clearTimeout(this._hRevealTimer);
        this._hRevealTimer = setTimeout(() => {
          ui.revealed.clear();
          ui.revealAll = false;
          if (this._hPlanId()) this._renderBody();
        }, HOARD_REVEAL_MS);
        return this._renderBody();
      }
      case "h-reveal-all":
        ui.revealAll = !ui.revealAll;
        if (!ui.revealAll) ui.revealed.clear();
        clearTimeout(this._hRevealTimer);
        if (ui.revealAll) {
          this._hRevealTimer = setTimeout(() => {
            ui.revealAll = false;
            ui.revealed.clear();
            if (this._hPlanId()) this._renderBody();
          }, HOARD_REVEAL_MS);
        }
        return this._renderBody();
      case "h-settings":
        return this._hSettingsOpen();
      case "h-settings-save":
        return this._hSettingsSave();
      default:
        return;
    }
  }

  /** Enter in the wishlist's inputs. */
  _hoardKey(el) {
    const data = el.dataset;
    const run = (promise) => promise.catch((err) => console.debug("TaskDragon action failed", err));
    if (data.hoardInput) run(this._hQuickAdd(data.hoardInput));
    else if (data.hurl) run(this._hoardAction("h-url-add", { dataset: { id: data.hurl } }));
    else if (data.hrecord) run(this._hoardAction("h-record", { dataset: { id: data.hrecord } }));
    else if (data.hsel) run(this._hoardAction("h-url-sel", { dataset: { id: data.hsel } }));
  }

  /** A form choice that changes which fields make sense (section type, or a gift section). */
  _hoardChange(el) {
    const d = this._dialog;
    if (d?.kind === "hoard-section" && el.name === "kind") {
      const v = this._hFormValues();
      d.section = { ...d.section, ...v, budget: v.budget === "" ? null : Number(v.budget) };
      this._renderDialog();
      return true;
    }
    if (d?.kind === "hoard-edit" && (el.name === "section_id" || el.name === "gift_for_person_id")) {
      const v = this._hFormValues();
      const keep = { ...v, target_price: v.target_price === "" ? null : Number(v.target_price), deal_max_price: v.deal_max_price === "" ? null : Number(v.deal_max_price) };
      delete keep.first_url;
      d.item = { ...d.item, ...keep };
      this._renderDialog();
      return true;
    }
    return false;
  }

  /** Typing the shelf price updates the verdict without re-rendering (and losing focus). */
  _hoardInput(el) {
    if (el.dataset?.hshelf === undefined && el.dataset?.hstore === undefined) return false;
    const d = this._dialog;
    if (d?.kind !== "hoard-scan") return true;
    this._hScanSync();
    const host = this.shadowRoot.querySelector(".hverdict-host");
    if (host) setHTML(host, this._hVerdictHtml(d));
    return true;
  }

  /* ---------------- Wishlist: deep links from price alerts ---------------- */

  async _hDeepLink() {
    if (this._hLinked) return;
    const params = new URLSearchParams(window.location.search);
    const planId = params.get("hoard_plan");
    const itemId = params.get("hoard_item");
    if (!planId && !itemId) {
      this._hLinked = true;
      return;
    }
    if (!this._board) return;
    this._hLinked = true;
    for (const key of ["hoard_plan", "hoard_item"]) params.delete(key);
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    const plans = this._activePlans().filter((p) => p.archetype === "wishlist_hoard" && (!planId || p.id === planId));
    for (const plan of plans) {
      const hb = await this._loadHoard(plan.id);
      if (!hb) continue;
      if (itemId && !hb.items.some((i) => i.id === itemId)) continue;
      this._ui.tab = plan.id;
      this._hUi().section = "all";
      this._render();
      if (itemId) this._hOpenDetail(plan.id, itemId);
      return;
    }
    this._showToast("That wishlist item isn't available — it was deleted or isn't shared with you");
  }

  /* ---------------- Dialogs ---------------- */

  _openDialog(dialog) {
    if (this._dialog && this._dialog !== dialog) this._cookClosed(this._dialog);
    this._dialog = dialog;
    this._renderDialog();
  }

  _closeDialog() {
    const previous = this._dialog;
    if (previous?.kind === "cook" && (this._timers || []).some((t) => !t.done) && !confirm("Close the recipe and stop its running timers?")) return;
    this._dialog = null;
    this._cookClosed(previous);
    this._renderDialog();
  }

  _renderDialog() {
    const host = this.shadowRoot.querySelector(".td-dialog-host");
    if (!this._dialog) {
      setHTML(host, html``);
      return;
    }
    const d = this._dialog;
    const renderers = {
      task: () => this._taskDialogHtml(d),
      snooze: () => this._snoozeDialogHtml(d),
      plan: () => this._planDialogHtml(d),
      categories: () => this._categoriesHtml(),
      promote: () => this._promoteHtml(d),
      trip: () => this._tripDialogHtml(d),
      pantry: () => this._pantryDialogHtml(d),
      "pantry-low": () => this._pantryLowHtml(d),
      "maint-object": () => this._mObjectDialogHtml(d),
      "maint-task": () => this._mTaskDialogHtml(d),
      "maint-complete": () => this._mCompleteDialogHtml(d),
      "maint-confirm": () => this._mConfirmDialogHtml(d),
      "maint-part": () => this._mPartDialogHtml(d),
      "maint-link": () => this._mLinkDialogHtml(d),
      "maint-salt": () => this._mSaltDialogHtml(d),
      "maint-qr": () => this._mQrDialogHtml(d),
      "maint-template": () => this._mTemplateDialogHtml(d),
      "recipe-review": () => this._recipeReviewHtml(d),
      "recipe-plan": () => this._recipePlanHtml(d),
      "scan-part": () => this._scanPartHtml(d),
      "scan-link": () => this._scanLinkHtml(d),
      "hoard-detail": () => this._hDetailHtml(d),
      "hoard-edit": () => this._hEditHtml(d),
      "hoard-purchase": () => this._hPurchaseHtml(d),
      "hoard-section": () => this._hSectionHtml(d),
      "hoard-scan": () => this._hScanHtml(d),
      "hoard-settings": () => this._hSettingsHtml(d),
      cook: () => this._cookHtml(d),
      settings: () => this._settingsHtml(d),
    };
    const inner = renderers[d.kind] ? renderers[d.kind]() : html``;
    const frame = { "scan-part": ["sheet-wrap", "sheet"], "hoard-scan": ["sheet-wrap", "sheet"], cook: ["cook-wrap", "cook"], settings: ["", "settings"] }[d.kind] || ["", ""];
    setHTML(
      host,
      html`<div class="backdrop ${frame[0]}" data-action="${d.kind === "cook" ? "noop" : "dialog-backdrop"}"><div class="dialog ${frame[1]}" role="dialog" aria-modal="true" aria-label="${d.kind === "cook" ? d.name : ""}">${inner}</div></div>`,
    );
    if (d.kind === "plan") this._mountIconPicker();
    if (d.kind === "maint-qr") this._mMountQr();
    if (d.kind === "cook") this._cookMounted(d);
    if (d.kind === "hoard-detail") this._hHydrate(host);
    const first = host.querySelector("[autofocus]");
    if (first) setTimeout(() => first.focus(), 30);
  }

  _closeButton() {
    return html`<button type="button" class="icon-btn" data-action="dialog-close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button>`;
  }

  _taskDialogHtml(d) {
    const t = d.task;
    const plans = this._activePlans().filter((p) => p.archetype !== "pantry_spices" && p.archetype !== "wishlist_hoard");
    const plan = this._idx.plans.get(t.plan_id) || plans[0];
    const people = this._board.people || [];
    const assigned = new Set(t.assigned_to || []);
    const rec = this._recurrenceForm(t);
    const siblings = (this._idx.byPlan.get(t.plan_id) || []).filter((x) => x.uid !== t.uid);
    const blockers = new Set(t.blocked_by || []);
    const isShopping = plan?.archetype === "shopping_errands";
    const isMaint = plan?.archetype === "home_maintenance";
    const isQuick = plan?.archetype === "quick_list";
    const isPacking = plan?.archetype === "packing_trips";
    const due = t.due_datetime ? toLocalInput(new Date(t.due_datetime)) : "";
    const kids = t.uid ? this._idx.children.get(t.uid) || [] : [];
    const sections = isQuick ? this._idx.sections.get(plan.id) || [] : [];
    const trips = isPacking ? (this._idx.trips.get(plan.id) || []).filter((x) => x.status !== "archived" || x.id === t.trip_id) : [];
    return html`<form class="task-form">
      <h2><span class="grow">${d.promoting ? "Make it recurring" : t.uid ? "Edit task" : "New task"}</span>${this._closeButton()}</h2>
      ${d.promoting ? html`<div class="banner"><ha-icon icon="mdi:repeat"></ha-icon>Pick how often it repeats and which plan it belongs to. Saving moves it off the quick list.</div>` : ""}
      <div class="form">
        <label class="full">Title<input name="summary" value="${t.summary || ""}" maxlength="500" required ${d.promoting ? "" : html`autofocus`}></label>
        <label>Plan<select name="plan_id">${plans.map((p) => html`<option value="${p.id}" ${p.id === t.plan_id ? html`selected` : ""}>${p.name}${p.is_private ? " (private)" : ""}</option>`)}</select></label>
        <label>Status<select name="status">${["needs_action", "in_process", "completed", "blocked"].map(
          (s) => html`<option value="${s}" ${t.status === s ? html`selected` : ""}>${s.replace("_", " ")}</option>`,
        )}${t.status === "snoozed" ? html`<option value="snoozed" selected>snoozed</option>` : ""}</select></label>
        ${isQuick
          ? html`<label>Section<select name="section_id"><option value="">Inbox</option>${sections.map(
              (s) => html`<option value="${s.id}" ${t.section_id === s.id ? html`selected` : ""}>${s.name}</option>`,
            )}</select></label>`
          : ""}
        ${isPacking
          ? html`<label>Trip<select name="trip_id"><option value="">Always pack (master list)</option>${trips.map(
              (x) => html`<option value="${x.id}" ${t.trip_id === x.id ? html`selected` : ""}>${x.name}</option>`,
            )}</select></label>
            <label>Group<input name="category" value="${t.category || ""}" maxlength="120" list="td-pack-groups" placeholder="Clothes, Tech…">
              <datalist id="td-pack-groups">${PACKING_GROUPS.map((g) => html`<option value="${g}">`)}</datalist></label>
            <label class="inline full"><input type="checkbox" name="is_repeatable" ${t.is_repeatable ? html`checked` : ""}>Repeatable — always pack on new trips</label>`
          : ""}
        ${isShopping || isPacking
          ? html`<label>Quantity<input name="quantity" value="${t.quantity || ""}" maxlength="120" placeholder="e.g. 2 lb"></label>`
          : ""}
        ${isShopping
          ? html`<label>Aisle<select name="category">${[...new Set([...AISLES, t.category].filter(Boolean))].map(
              (c) => html`<option ${c === (t.category || "Other") ? html`selected` : ""}>${c}</option>`,
            )}</select></label>`
          : ""}
        <label>Priority<select name="priority">${PRIORITIES.map((p) => html`<option ${p === (t.priority || "none") ? html`selected` : ""}>${p}</option>`)}</select></label>
        <label>Time of day<select name="time_of_day_bucket">${BUCKETS.map(([b, l]) => html`<option value="${b}" ${b === (t.time_of_day_bucket || "anytime") ? html`selected` : ""}>${l}</option>`)}</select></label>
        <label>Due date<input type="date" name="due_date" value="${t.due_datetime ? "" : t.due_date || ""}"></label>
        <label>…or due at<input type="datetime-local" name="due_datetime" value="${due}"></label>
        <label class="full">Assigned to <span class="toggle-group">${people.map(
          (p) => html`<label class="inline"><input type="checkbox" name="assignee" value="${p.entity_id}" ${assigned.has(p.entity_id) ? html`checked` : ""}>${this._avatar(p)} ${p.name}</label>`,
        )}<span class="lastdone">Leave everyone unchecked for the household pool.</span></span></label>
        <label>Repeats<select name="rec_kind">
          ${[["none", "Never"], ["daily", "Daily"], ["weekly", "Weekly on…"], ["monthly", "Monthly"], ["rolling", "N days after completion"], ["custom", "Custom RRULE"]].map(
            ([k, l]) => html`<option value="${k}" ${rec.kind === k ? html`selected` : ""}>${l}</option>`,
          )}</select></label>
        <label class="rec rec-weekly" ${rec.kind === "weekly" ? "" : html`hidden`}>Days<span class="toggle-group">${WEEKDAYS.map(
          ([code, l]) => html`<label class="inline"><input type="checkbox" name="rec_day" value="${code}" ${rec.days.includes(code) ? html`checked` : ""}>${l}</label>`,
        )}</span></label>
        <label class="rec rec-monthly" ${rec.kind === "monthly" ? "" : html`hidden`}>Day of month<input type="number" min="1" max="31" name="rec_monthday" value="${rec.monthday}"></label>
        <label class="rec rec-rolling" ${rec.kind === "rolling" ? "" : html`hidden`}>Days after completion<input type="number" min="1" name="rec_interval" value="${t.recurrence_interval_days || 90}"></label>
        <label class="rec rec-custom" ${rec.kind === "custom" ? "" : html`hidden`}>RRULE<input name="rec_rule" value="${t.recurrence_rule || ""}" maxlength="400" placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"></label>
        ${isMaint ? "" : this._reminderFieldsHtml(t, people)}
        <label class="inline"><input type="checkbox" name="shift_aware" ${t.shift_aware ? html`checked` : ""}>Shift-aware (assign daily to whoever is off work)</label>
        ${isMaint
          ? html`<div class="full banner"><ha-icon icon="mdi:tools"></ha-icon>This becomes a task on the “General” object. Open the maintenance tab for intervals, sensor triggers, parts and NFC.</div>`
          : ""}
        ${siblings.length && !isShopping && !isPacking
          ? html`<label class="full">Blocked by<div class="picklist">${siblings
              .filter((s) => s.status !== "completed" || blockers.has(s.uid))
              .map((s) => html`<label><input type="checkbox" name="blocked_by" value="${s.uid}" ${blockers.has(s.uid) ? html`checked` : ""}>${s.summary}</label>`)}</div></label>
             <label class="inline full"><input type="checkbox" name="hide_when_blocked" ${t.hide_when_blocked ? html`checked` : ""}>Hide from My Day / Ready while blocked</label>`
          : ""}
        <label class="full">Notes (Markdown)<textarea name="description" maxlength="20000">${t.description || ""}</textarea></label>
        ${t.uid
          ? html`<div class="full"><div class="section-head">Checklist</div>${this._subtasksHtml(t, "dlg")}</div>`
          : html`<label class="full">Checklist (one item per line)<textarea name="subtasks" placeholder="Buy screws&#10;Mark studs"></textarea></label>`}
        ${t.uid ? html`<div class="full history-block">${this._historyHtml(d.history)}</div>` : ""}
      </div>
      <div class="dialog-actions">
        ${t.uid && !d.promoting ? html`<button type="button" class="btn danger" data-action="dialog-delete"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        <span class="grow"></span>
        ${kids.length ? html`<span class="lastdone">${kids.filter((k) => k.status === "completed").length}/${kids.length} checklist items done</span>` : ""}
        <button type="button" class="btn flat" data-action="dialog-close">Cancel</button>
        <button type="button" class="btn" data-action="dialog-save">${d.promoting ? "Save & move" : "Save"}</button>
      </div>
    </form>`;
  }

  /** "Remind: [phone] at [time]" for the task dialog; phones come from Home Assistant's companion apps. */
  _reminderFieldsHtml(t, people) {
    const targets = this._board.notify_targets || [];
    const phones = targets.filter((x) => x.kind === "phone");
    const others = targets.filter((x) => x.kind !== "phone");
    const owner = (x) => x.people.map((p) => people.find((q) => q.entity_id === p)?.name).filter(Boolean).join(", ");
    const current = t.remind_target || "";
    const missing = current && current !== "assigned" && !targets.some((x) => x.id === current);
    const placeholder = t.due_datetime ? fmtTime(new Date(t.due_datetime)) : { morning: "08:00", afternoon: "13:00", evening: "18:00" }[t.time_of_day_bucket] || "09:00";
    return html`<div class="full remind-row">
        <label>Phone reminder<select name="remind_target" data-remind-target>
          <option value="" ${current ? "" : html`selected`}>No reminder</option>
          <option value="assigned" ${current === "assigned" ? html`selected` : ""}>Whoever it's assigned to</option>
          ${phones.length ? html`<optgroup label="Phones & tablets">${phones.map((x) => html`<option value="${x.id}" ${x.id === current ? html`selected` : ""}>${x.name}${owner(x) ? ` (${owner(x)})` : ""}</option>`)}</optgroup>` : ""}
          ${others.length ? html`<optgroup label="Other notify services">${others.map((x) => html`<option value="${x.id}" ${x.id === current ? html`selected` : ""}>${x.name}</option>`)}</optgroup>` : ""}
          ${missing ? html`<option value="${current}" selected>${current} (not found)</option>` : ""}
        </select></label>
        <label>At<input type="time" name="remind_time" value="${t.remind_time || ""}" ${current ? "" : html`disabled`} aria-label="Reminder time"></label>
      </div>
      <span class="lastdone full remind-hint">${phones.length
        ? `On the due date at this time (empty: ${placeholder}), and again every time it repeats. The notification has Done and Snooze buttons.`
        : "No phones found. Install the Home Assistant companion app on a phone and sign in to get reminders here."}</span>`;
  }

  _historyHtml(history) {
    if (!history) return html``;
    return html`<div class="section-head">Completion history</div>${
      history.length
        ? html`<ul class="history-list">${history.map(
            (h) => html`<li>${h.person_entity_id ? this._person(h.person_entity_id).name : h.user_name || "Someone"} — ${new Date(h.completed_at).toLocaleString()}</li>`,
          )}</ul>`
        : html`<div class="lastdone">Never completed yet.</div>`
    }`;
  }

  _refreshDialogSubtasks() {
    const d = this._dialog;
    if (d?.kind !== "task" || !d.task.uid || !this._idx) return;
    const container = this.shadowRoot.querySelector(".task-form .subtasks");
    if (!container) return;
    const focus = this._captureFocus();
    const fresh = this._idx.tasks.get(d.task.uid);
    if (!fresh) return;
    const holder = document.createElement("div");
    setHTML(holder, this._subtasksHtml(fresh, "dlg"));
    container.replaceWith(...holder.childNodes);
    this._restoreFocus(focus);
  }

  _recurrenceForm(t) {
    const out = { kind: "none", days: [], monthday: new Date().getDate() };
    if (t.recurrence_mode === "rolling") return { ...out, kind: "rolling" };
    if (t.recurrence_mode !== "calendar" || !t.recurrence_rule) return out;
    const parts = Object.fromEntries(t.recurrence_rule.split(";").map((p) => p.split("=")));
    const keys = Object.keys(parts).filter((k) => k !== "FREQ");
    if (parts.FREQ === "DAILY" && !keys.length) return { ...out, kind: "daily" };
    if (parts.FREQ === "WEEKLY" && keys.every((k) => k === "BYDAY")) return { ...out, kind: "weekly", days: (parts.BYDAY || "").split(",").filter(Boolean) };
    if (parts.FREQ === "MONTHLY" && keys.every((k) => k === "BYMONTHDAY")) return { ...out, kind: "monthly", monthday: parts.BYMONTHDAY || out.monthday };
    return { ...out, kind: "custom" };
  }

  _snoozeDialogHtml(d) {
    const now = new Date();
    const at = (days, hour) => {
      const x = new Date(now);
      x.setDate(x.getDate() + days);
      x.setHours(hour, 0, 0, 0);
      return x;
    };
    const saturday = (() => {
      const x = at(0, 9);
      const diff = (6 - x.getDay() + 7) % 7 || (now.getHours() >= 9 ? 7 : 0);
      x.setDate(x.getDate() + diff);
      return x;
    })();
    const monday = (() => {
      const x = at(0, 8);
      x.setDate(x.getDate() + (((8 - x.getDay()) % 7) || 7));
      return x;
    })();
    const evening = now.getHours() < 18 ? at(0, 18) : at(1, 18);
    const options = [
      ["mdi:clock-fast", "In 1 hour", new Date(now.getTime() + 3600000)],
      ["mdi:weather-night", now.getHours() < 18 ? "This evening" : "Tomorrow evening", evening],
      ["mdi:weather-sunset-up", "Tomorrow morning", at(1, 8)],
      ["mdi:calendar-weekend", "This weekend", saturday],
      ["mdi:calendar-arrow-right", "Next week", monday],
    ];
    const hasWeather = !!this._board.options?.weather_entity;
    const me = this._me();
    return html`<h2><span class="grow">Snooze “${d.task.summary}”</span>${this._closeButton()}</h2>
      <div class="section-head">Until a time</div>
      <div class="snooze-grid">${options.map(
        ([icon, label, when]) => html`<button data-action="snooze-time" data-until="${when.toISOString()}"><ha-icon icon="${icon}"></ha-icon><span>${label}<small>${when.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</small></span></button>`,
      )}
        <button data-action="noop"><ha-icon icon="mdi:calendar-clock"></ha-icon><span>Pick a time<small><input type="datetime-local" class="snooze-custom" value="${toLocalInput(at(1, 9))}" data-stop></small></span></button>
      </div>
      <div class="dialog-actions" style="margin:-6px 0 12px"><button class="btn small flat" data-action="snooze-custom">Snooze until picked time</button></div>
      <div class="section-head">Until the moment is right</div>
      <div class="snooze-grid">
        <button data-action="snooze-ctx" data-type="person_home" ${me ? "" : html`disabled`}><ha-icon icon="mdi:home-import-outline"></ha-icon><span>Next time I'm home<small>${me ? this._person(me).name : "Link your user to a person"}</small></span></button>
        <button data-action="snooze-ctx" data-type="all_home"><ha-icon icon="mdi:home-group"></ha-icon><span>When we're all home<small>${(this._board.people || []).map((p) => p.name).join(" + ") || "Household"}</small></span></button>
        <button data-action="snooze-ctx" data-type="weekend_dry" ${hasWeather ? "" : html`disabled`}><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon><span>This weekend if it's not raining<small>${hasWeather ? this._board.options.weather_entity : "Set a weather entity in TaskDragon options"}</small></span></button>
      </div>
      <div class="section-head">When an entity changes</div>
      <div class="form">
        <label class="full">Entity<input class="snooze-entity" maxlength="255" placeholder="e.g. binary_sensor.garage_door" list="td-all-entities">
          <datalist id="td-all-entities">${Object.keys(this._hass?.states || {}).slice(0, 600).map((e) => html`<option value="${e}">`)}</datalist></label>
        <label>Becomes state<input class="snooze-state" maxlength="255" placeholder="on / home / open"></label>
        <label>…or goes above<input class="snooze-above" type="number" step="any"></label>
        <label>…or goes below<input class="snooze-below" type="number" step="any"></label>
      </div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button><button class="btn" data-action="snooze-entity">Snooze until then</button></div>`;
  }

  _iconFieldHtml(icon) {
    const current = icon || "";
    return html`<div class="full field">Icon
      <div class="icon-field">
        <span class="icon-preview"><ha-icon data-icon-preview icon="${current || "mdi:format-list-checks"}"></ha-icon></span>
        <input name="icon" data-icon-input value="${current}" maxlength="64" placeholder="mdi:broom" aria-label="Icon name (mdi:…)">
      </div>
      <div class="icon-picker-slot"></div>
      <div class="icon-grid" role="listbox" aria-label="Common icons">${ICON_CHOICES.map(
        (name) => html`<button type="button" class="${name === current ? "on" : ""}" data-action="pick-icon" data-id="${name}" title="${name}" aria-label="${name}"><ha-icon icon="${name}"></ha-icon></button>`,
      )}</div>
    </div>`;
  }

  _mountIconPicker() {
    // Use Home Assistant's own searchable MDI picker when the frontend has loaded it.
    const slot = this.shadowRoot.querySelector(".icon-picker-slot");
    const input = this.shadowRoot.querySelector("[data-icon-input]");
    if (!slot || !input || !customElements.get("ha-icon-picker")) return;
    const picker = document.createElement("ha-icon-picker");
    picker.hass = this._hass;
    picker.value = input.value;
    picker.label = "Search all Material Design icons";
    picker.addEventListener("value-changed", (event) => this._setIcon(event.detail?.value || ""));
    slot.replaceChildren(picker);
  }

  _setIcon(value) {
    const icon = String(value || "").trim();
    const input = this.shadowRoot.querySelector("[data-icon-input]");
    const preview = this.shadowRoot.querySelector("[data-icon-preview]");
    if (input && input.value !== icon) input.value = icon;
    if (preview) preview.setAttribute("icon", /^mdi:[a-z0-9-]+$/.test(icon) ? icon : "mdi:format-list-checks");
    for (const button of this.shadowRoot.querySelectorAll(".icon-grid button")) button.classList.toggle("on", button.dataset.id === icon);
  }

  _planDialogHtml(d) {
    const p = d.plan;
    const isNew = !p.id;
    const settings = p.settings || {};
    const admin = this._isAdmin();
    const userId = this._board.user?.id;
    const shoppingPlans = this._activePlans().filter((x) => x.archetype === "shopping_errands" && !x.is_private);
    const chorePlans = this._activePlans().filter((x) => x.archetype === "daily_chores" && !x.is_private);
    const privateNow = isNew ? !!p.is_private : p.is_private;
    const canChangeVisibility = isNew || (p.is_private ? p.is_owner : admin || p.is_owner);
    const sharable = (this._board.people || []).filter((person) => person.user_id && person.user_id !== userId);
    const sharedWith = new Set(p.shared_with || []);
    const personal = !!settings.personal_quick;
    return html`<h2><span class="grow">${isNew ? "New category" : html`Category settings — ${p.name}`}</span>${this._closeButton()}</h2>
      <div class="form plan-form">
        <label class="full">Name<input name="name" value="${p.name || ""}" maxlength="120" placeholder="e.g. Calls to Make, Garden, Up North" autofocus></label>
        ${this._iconFieldHtml(p.icon)}
        ${canChangeVisibility && !personal
          ? html`<div class="full field">Visibility
              <div class="toggle-group">
                <label class="inline"><input type="radio" name="visibility" value="shared" ${privateNow ? "" : html`checked`}><ha-icon icon="mdi:home-heart"></ha-icon>Shared household</label>
                <label class="inline"><input type="radio" name="visibility" value="private" ${privateNow ? html`checked` : ""}><ha-icon icon="mdi:lock-outline"></ha-icon>Private to me</label>
              </div>
              <span class="lastdone">Private categories are filtered on the server: other users (administrators included) never receive them, and they get no Home Assistant entity.</span>
            </div>`
          : html`<div class="full field">Visibility<span>${privateNow ? "🔒 Private" : "Shared household"}${p.is_private && !p.is_owner ? " (shared with you)" : ""}</span></div>`}
        ${!isNew && p.is_private && p.is_owner
          ? html`<div class="full field">Share with
              <div class="toggle-group">${sharable.length
                ? sharable.map(
                    (person) => html`<label class="inline"><input type="checkbox" name="share" value="${person.user_id}" ${sharedWith.has(person.user_id) ? html`checked` : ""}>${this._avatar(person)} ${person.name}</label>`,
                  )
                : html`<span class="lastdone">Link household members' users to their person entities to share with them.</span>`}</div>
            </div>`
          : ""}
        ${isNew
          ? html`<div class="full field">Behavior
              <div class="choice-grid wide">${Object.entries(ARCHETYPES).map(
                ([k, v]) => html`<label class="choice"><input type="radio" name="archetype" value="${k}" ${(p.archetype || "quick_list") === k ? html`checked` : ""}><ha-icon icon="${v.icon}"></ha-icon><span>${v.label}<small>${v.hint}</small></span></label>`,
              )}</div>
            </div>`
          : html`<label>Behavior<input value="${ARCHETYPES[p.archetype]?.label || p.archetype}" disabled></label>`}
        ${admin && !privateNow && !isNew
          ? html`<label>Routing role<select name="role">${[["", "—"], ["quick", "Household quick list"], ["chores", "Default chores plan"], ["groceries", "Default grocery list"], ["hardware", "Hardware list"]].map(
              ([v, l]) => html`<option value="${v}" ${(settings.role || "") === v ? html`selected` : ""}>${l}</option>`,
            )}</select></label>`
          : ""}
        ${p.archetype === "shopping_errands"
          ? html`<label>Default aisle<select name="default_category"><option value="">Automatic</option>${AISLES.map((a) => html`<option ${settings.default_category === a ? html`selected` : ""}>${a}</option>`)}</select></label>
             ${this._board.mealie?.enabled && admin
               ? html`<label>Mealie shopping list<select name="mealie_list_id"><option value="">Not synced</option>${(d.mealieLists || []).map(
                   (l) => html`<option value="${l.id}" ${settings.mealie_list_id === l.id ? html`selected` : ""}>${l.name}</option>`,
                 )}</select></label>`
               : ""}`
          : ""}
        ${p.archetype === "pantry_spices"
          ? html`<label>Push ingredients to<select name="shopping_plan_id"><option value="">Default grocery list</option>${shoppingPlans.map((x) => html`<option value="${x.id}" ${settings.shopping_plan_id === x.id ? html`selected` : ""}>${x.name}</option>`)}</select></label>
             <label>Batch tasks go to<select name="chore_plan_id"><option value="">Default chores plan</option>${chorePlans.map((x) => html`<option value="${x.id}" ${settings.chore_plan_id === x.id ? html`selected` : ""}>${x.name}</option>`)}</select></label>`
          : ""}
      </div>
      <div class="dialog-actions">
        ${!isNew && p.can_manage && !personal ? html`<button class="btn danger" data-action="plan-delete"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        ${!isNew && p.can_manage && !personal ? html`<button class="btn flat" data-action="plan-archive">Archive</button>` : ""}
        ${!isNew ? html`<button class="btn flat" data-action="tab-visibility" data-id="${this._idx.quickIds.has(p.id) ? "quick" : p.id}">Hide tab</button>` : ""}
        <span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="plan-save">${isNew ? "Create" : "Save"}</button>
      </div>`;
  }

  _categoriesHtml() {
    const tabs = this._allTabs();
    const hidden = new Set(this._prefs().hidden_tabs);
    const archived = (this._board.plans || []).filter((p) => p.archived && !this._idx.quickIds.has(p.id));
    return html`<h2><span class="grow">Manage categories</span>${this._closeButton()}</h2>
      <p class="hint">Hide tabs you aren't using right now and put the rest in your order. This only changes your own view.</p>
      ${tabs.map((t, i) => {
        const off = hidden.has(t.key);
        return html`<div class="cat-row ${off ? "hidden-tab" : ""}">
          <button class="icon-btn sm" data-action="tab-visibility" data-id="${t.key}" aria-pressed="${!off}" title="${off ? "Show this tab" : "Hide this tab"}" aria-label="${off ? "Show" : "Hide"} ${t.label}"><ha-icon icon="${off ? "mdi:eye-off-outline" : "mdi:eye-outline"}"></ha-icon></button>
          <span class="name"><ha-icon icon="${t.icon}"></ha-icon>${t.label}${t.plan?.is_private ? html`<ha-icon class="lock" icon="mdi:lock-outline" title="Private"></ha-icon>` : ""}
            ${t.plan ? html`<small class="lastdone">${ARCHETYPES[t.plan.archetype]?.label || ""}</small>` : ""}</span>
          <button class="icon-btn sm" data-action="tab-move" data-id="${t.key}" data-dir="-1" ${i === 0 ? html`disabled` : ""} aria-label="Move ${t.label} up"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button class="icon-btn sm" data-action="tab-move" data-id="${t.key}" data-dir="1" ${i === tabs.length - 1 ? html`disabled` : ""} aria-label="Move ${t.label} down"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          ${t.plan
            ? html`<button class="icon-btn sm" data-action="plan-edit" data-id="${t.key}" title="Settings" aria-label="${t.label} settings"><ha-icon icon="mdi:cog-outline"></ha-icon></button>`
            : html`<span class="icon-btn sm" aria-hidden="true"></span>`}
        </div>`;
      })}
      ${archived.length
        ? html`<div class="section-head" style="margin-top:12px">Archived</div>${archived.map(
            (p) => html`<div class="cat-row hidden-tab"><span class="name"><ha-icon icon="${p.icon || ARCHETYPES[p.archetype]?.icon || "mdi:archive-outline"}"></ha-icon>${p.name}</span>
              ${p.can_manage ? html`<button class="btn small flat" data-action="plan-unarchive" data-id="${p.id}">Restore</button>` : ""}</div>`,
          )}`
        : ""}
      <div class="dialog-actions"><button class="btn flat" data-action="plan-new"><ha-icon icon="mdi:plus"></ha-icon>New category</button><span class="grow"></span><button class="btn" data-action="dialog-close">Done</button></div>`;
  }

  _promoteHtml(d) {
    const task = d.task;
    const targets = this._activePlans().filter((p) => p.id !== task.plan_id && p.archetype !== "pantry_spices" && p.archetype !== "wishlist_hoard" && !this._idx.quickIds.has(p.id));
    const order = (p) => (p.archetype === "quick_list" ? 1 : 0) + (p.is_private ? 2 : 0);
    targets.sort((a, b) => order(a) - order(b));
    return html`<h2><span class="grow">Move “${task.summary}” to…</span>${this._closeButton()}</h2>
      <p class="hint">Quick list items are one-offs. Move this one into a structured plan, or make it repeat.</p>
      <div class="choice-grid">${targets.map(
        (p) => html`<button data-action="promote-to" data-id="${p.id}"><ha-icon icon="${p.icon || ARCHETYPES[p.archetype]?.icon || "mdi:format-list-checks"}"></ha-icon>
          <span>${p.name}${p.is_private ? " 🔒" : ""}<small>${ARCHETYPES[p.archetype]?.label || ""}</small></span></button>`,
      )}</div>
      <div class="section-head">Make it recurring</div>
      <div class="choice-grid"><button data-action="promote-recurring"><ha-icon icon="mdi:repeat"></ha-icon><span>Repeat it…<small>Choose how often; it moves to a chores plan</small></span></button></div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button></div>`;
  }

  _tripDialogHtml(d) {
    const t = d.trip;
    const isNew = !t.id;
    const plan = this._idx.plans.get(t.plan_id);
    const repeatable = plan?.repeatable_count || 0;
    return html`<h2><span class="grow">${isNew ? "New trip" : html`Edit “${t.name}”`}</span>${this._closeButton()}</h2>
      <div class="form trip-form">
        <label class="full">Trip name<input name="name" value="${t.name || ""}" maxlength="120" placeholder="Up North Cabin" autofocus></label>
        <label>Starts<input type="date" name="start_date" value="${t.start_date || ""}"></label>
        <label>Ends<input type="date" name="end_date" value="${t.end_date || ""}"></label>
        ${isNew
          ? html`<div class="full banner"><ha-icon icon="mdi:repeat"></ha-icon>${repeatable ? `${repeatable} repeatable item${repeatable === 1 ? "" : "s"} will be added, unchecked.` : "Mark items repeatable and they'll be added to every new trip."}</div>`
          : html`<label class="inline full"><input type="checkbox" name="archived" ${t.status === "archived" ? html`checked` : ""}>Archived (hide from the list)</label>`}
      </div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button><button class="btn" data-action="trip-save">${isNew ? "Create trip" : "Save"}</button></div>`;
  }

  _pantryDialogHtml(d) {
    const i = d.item;
    const ingredients = (i.ingredients || []).map((x) => x.text || x.name).join("\n");
    return html`<h2><span class="grow">${i.id ? i.name : "New pantry item"}</span>${this._closeButton()}</h2>
      <div class="form pantry-form">
        <label class="full">Name<input name="name" value="${i.name || ""}" maxlength="120" autofocus></label>
        <label>Category<input name="category" value="${i.category || ""}" maxlength="120" placeholder="Spices, Baking, Bulk…"></label>
        <label>Amount on hand<input name="quantity" value="${i.quantity || ""}" maxlength="120" placeholder="e.g. 1 jar"></label>
        <label class="inline"><input type="checkbox" name="is_batch" ${i.is_batch ? html`checked` : ""}>Homemade batch / blend</label>
        <label>When low or out<select name="low_action">${[["ask", "Ask me"], ["shopping", "Add ingredients to shopping list"], ["batch_task", "Create “make a batch” task"], ["none", "Do nothing"]].map(
          ([v, l]) => html`<option value="${v}" ${i.low_action === v ? html`selected` : ""}>${l}</option>`,
        )}</select></label>
        <label>Mealie recipe slug<input name="mealie_recipe_slug" value="${i.mealie_recipe_slug || ""}" maxlength="120" placeholder="taco-seasoning"></label>
        <label class="full">Ingredients (one per line)<textarea name="ingredients" maxlength="20000" placeholder="2 tbsp chili powder&#10;1 tbsp cumin">${ingredients}</textarea></label>
        <label class="full">Notes<input name="notes" value="${i.notes || ""}" maxlength="2000"></label>
      </div>
      <div class="dialog-actions">
        ${i.id ? html`<button class="btn danger" data-action="pantry-delete"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        ${i.id && i.mealie_recipe_slug && this._board.mealie?.enabled ? html`<button class="btn flat" data-action="pantry-fetch"><ha-icon icon="mdi:download"></ha-icon>Load ingredients from Mealie</button>` : ""}
        <span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="pantry-save">Save</button>
      </div>`;
  }

  _pantryLowHtml(d) {
    const i = d.item;
    return html`<h2><span class="grow">${i.name} is ${d.state === "out" ? "out" : "running low"}</span>${this._closeButton()}</h2>
      <p>What should TaskDragon do?</p>
      <div class="snooze-grid">
        <button data-action="pantry-low-choice" data-choice="shopping"><ha-icon icon="mdi:cart-plus"></ha-icon><span>Add to shopping list<small>${i.ingredients?.length ? `${i.ingredients.length} raw ingredients` : i.name}</small></span></button>
        <button data-action="pantry-low-choice" data-choice="batch_task"><ha-icon icon="mdi:pot-steam-outline"></ha-icon><span>Make a new batch<small>Adds a chore with the recipe</small></span></button>
        <button data-action="pantry-low-choice" data-choice="none"><ha-icon icon="mdi:close-circle-outline"></ha-icon><span>Nothing for now</span></button>
      </div>`;
  }

  /* ---------------- Toast ---------------- */

  /** ``actions``: extra buttons, [{ label, run }] (e.g. "Mark low" after a pantry scan). */
  _showToast(message, undo = null, actions = []) {
    clearTimeout(this._toastTimer);
    this._toast = { message, undo, actions };
    const host = this.shadowRoot.querySelector(".td-toast-host");
    setHTML(
      host,
      html`<div class="td-toast" role="status"><span>${message}</span>${actions.map((a, i) => html`<button data-action="toast-act" data-index="${i}">${a.label}</button>`)}${undo ? html`<button data-action="undo">Undo</button>` : ""}</div>`,
    );
    this._toastTimer = setTimeout(() => {
      this._toast = null;
      setHTML(host, html``);
    }, actions.length ? 9000 : undo ? UNDO_MS : 3500);
  }

  _fail(err) {
    console.error("TaskDragon:", err);
    this._showToast(err?.message || String(err));
  }

  /** An undo callback for a server-side undo token (or nothing when there is none). */
  _undoWith(token) {
    return token ? () => this._call({ type: "taskdragon/undo", token }) : null;
  }

  /* ---------------- Maintenance dialogs ---------------- */

  _mOptions(list, value, empty = null) {
    return html`${empty !== null ? html`<option value="">${empty}</option>` : ""}${list.map(
      ([v, l]) => html`<option value="${v}" ${String(v) === String(value ?? "") ? html`selected` : ""}>${l}</option>`,
    )}`;
  }

  _mEntityList(id, domains) {
    const ids = Object.keys(this._hass?.states || {}).filter((e) => domains.some((d) => e.startsWith(`${d}.`))).sort().slice(0, 600);
    return html`<datalist id="${id}">${ids.map((e) => html`<option value="${e}">${this._hass.states[e].attributes?.friendly_name || ""}</option>`)}</datalist>`;
  }

  _mObjectDialogHtml(d) {
    const o = d.obj;
    const mb = this._mBoard();
    const cfg = o.config || {};
    const zones = Object.keys(this._hass?.states || {}).filter((e) => e.startsWith("zone.")).map((e) => [e, this._hass.states[e].attributes?.friendly_name || e]);
    const descendants = new Set([o.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const other of mb?.objects || []) {
        if (other.parent_object_id && descendants.has(other.parent_object_id) && !descendants.has(other.id)) {
          descendants.add(other.id);
          grew = true;
        }
      }
    }
    const parents = (mb?.objects || []).filter((x) => !descendants.has(x.id)).map((x) => [x.id, `${x.name} ${x.code}`]);
    const softener = o.object_type === "water_softener";
    const field = (label, name, value, attrs = html``) => html`<label>${label}<input name="${name}" value="${value ?? ""}" ${attrs}></label>`;
    return html`<h2><span class="grow">${o.id ? html`Edit ${o.name} <span class="mid">${o.code}</span>` : "New object"}</span>${this._closeButton()}</h2>
      <div class="form mobject-form">
        <label class="full">Name<input name="name" value="${o.name || ""}" maxlength="120" placeholder="Furnace, Water Softener, Honda CR-V…" autofocus></label>
        ${field("Manufacturer / model", "manufacturer_model", o.manufacturer_model, html`maxlength="120" placeholder="Carrier 59SC5 / GE GXSH40V"`)}
        <label>Type<select name="object_type">${this._mOptions(MAINT_OBJECT_TYPES, o.object_type || "generic")}</select></label>
        <label>Area<select name="area_id">${this._mOptions((mb?.areas || []).map((a) => [a.area_id, a.name]), o.area_id, "No area")}</select></label>
        <label>Notify when someone is in<select name="zone_entity_id">${this._mOptions(zones, o.zone_entity_id, "Anywhere (notify right away)")}</select></label>
        <label>Inside (parent object)<select name="parent_object_id">${this._mOptions(parents, o.parent_object_id, "Top level")}</select></label>
        ${field("Icon", "icon", o.icon, html`maxlength="64" placeholder="mdi:water-boiler"`)}
        <label>Installed<input type="date" name="installed_date" value="${o.installed_date || ""}"></label>
        <label>Warranty expires<input type="date" name="warranty_expiry_date" value="${o.warranty_expiry_date || ""}"></label>
        <label>Warranty reminder (days before)<input type="number" min="0" max="365" name="warranty_reminder_days" value="${o.warranty_reminder_days ?? 30}"></label>
        <label class="full">Notes (Markdown)<textarea name="notes" maxlength="20000" placeholder="Filter size, service company phone, quirks…">${o.notes || ""}</textarea></label>
        ${softener
          ? html`<div class="full banner"><ha-icon icon="mdi:water-opacity"></ha-icon>Link a total water volume sensor (Droplet, a utility_meter…) and TaskDragon learns how many gallons each level of salt lasts.</div>
            ${field("Total water volume sensor", "cfg_volume_entity", cfg.volume_entity, html`list="m-sensors" maxlength="255" placeholder="sensor.droplet_water_total"`)}
            ${field("Flow rate sensor (regeneration)", "cfg_flow_entity", cfg.flow_entity, html`list="m-sensors" maxlength="255" placeholder="sensor.droplet_flow_rate"`)}
            <label>Volume unit<select name="cfg_unit">${this._mOptions([["gal", "Gallons"], ["L", "Liters"]], cfg.unit || "gal")}</select></label>
            <label>How you read the tank<select name="cfg_scale">${this._mOptions([["levels", "Level marks (8 → 1)"], ["percent", "Percent"], ["bags", "Bags of salt"]], cfg.scale || "levels")}</select></label>
            ${field("Top level", "cfg_max_level", cfg.max_level ?? 8, html`type="number" min="1" max="100" step="any"`)}
            ${field("Bottom level", "cfg_min_level", cfg.min_level ?? 0, html`type="number" min="0" max="99" step="any"`)}
            ${field("Tank holds (bags)", "cfg_capacity_bags", cfg.capacity_bags ?? 4, html`type="number" min="0.5" max="50" step="any"`)}
            ${field("Bag size (lb)", "cfg_bag_lb", cfg.bag_lb ?? 40, html`type="number" min="1" max="200" step="any"`)}
            ${field("Refill warning at level", "cfg_warning_level", cfg.warning_level, html`type="number" min="0" step="any" placeholder="e.g. 2"`)}
            ${field("Initial gallons per full tank (optional)", "cfg_initial_tank_volume", cfg.initial_tank_volume, html`type="number" min="1" step="any"`)}
            ${field("Regeneration window starts", "cfg_regen_start", cfg.regen_start || "02:00", html`type="time"`)}
            ${field("Regeneration window ends", "cfg_regen_end", cfg.regen_end || "04:00", html`type="time"`)}
            ${field("Regeneration flow at least", "cfg_regen_min_flow", cfg.regen_min_flow ?? 0.5, html`type="number" min="0" step="any"`)}
            ${field("…for at least (minutes)", "cfg_regen_min_minutes", cfg.regen_min_minutes ?? 8, html`type="number" min="1" step="any"`)}
            ${field("Salt distance sensor (optional)", "cfg_level_entity", cfg.level_entity, html`list="m-sensors" maxlength="255" placeholder="sensor.brine_tank_distance"`)}
            ${field("Sensor reading when empty", "cfg_level_empty", cfg.level_empty, html`type="number" step="any" placeholder="e.g. 80 cm"`)}
            ${field("Sensor reading when full", "cfg_level_full", cfg.level_full, html`type="number" step="any" placeholder="e.g. 15 cm"`)}
            ${this._mEntityList("m-sensors", ["sensor"])}`
          : ""}
      </div>
      <div class="dialog-actions">
        ${o.id ? html`<button class="btn danger" data-action="m-delete-object" data-id="${o.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        <span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="m-object-save">${o.id ? "Save" : "Create object"}</button>
      </div>`;
  }

  _mTriggerEditor(tr, index) {
    const f = (label, name, value, attrs = html``, cls = "") =>
      html`<label class="${cls}">${label}<input data-tfield="${name}" value="${value ?? ""}" ${attrs}></label>`;
    const entity = f("Entity", "entity_id", tr.entity_id, html`list="m-trigger-entities" maxlength="255" placeholder="sensor.furnace_runtime"`, "full");
    let fields;
    switch (tr.type) {
      case "threshold":
        fields = html`${entity}${f("Above", "above", tr.above, html`type="number" step="any"`)}${f("Below", "below", tr.below, html`type="number" step="any"`)}
          ${f("For at least (minutes)", "for_minutes", tr.for_minutes ?? 0, html`type="number" min="0" step="any"`, "full")}`;
        break;
      case "counter":
        fields = html`${entity}${f("After it increases by", "delta", tr.delta, html`type="number" min="0" step="any" placeholder="e.g. 1000"`)}${f("Unit", "unit", tr.unit, html`maxlength="20" placeholder="gal, kWh, mi, h"`)}`;
        break;
      case "runtime":
        fields = html`${entity}${f("While the state is", "target_state", tr.target_state ?? "on", html`maxlength="100" placeholder="on, heating, printing"`)}
          ${f("Attribute (optional)", "attribute", tr.attribute, html`maxlength="64" placeholder="hvac_action"`)}
          ${f("For a total of (hours)", "target_hours", tr.target_hours, html`type="number" min="0.01" step="any" placeholder="e.g. 300"`, "full")}`;
        break;
      case "state_count":
        fields = html`${entity}${f("Changes from (optional)", "from_state", tr.from_state, html`maxlength="100" placeholder="off"`)}${f("Changes to", "to_state", tr.to_state ?? "on", html`maxlength="100"`)}
          ${f("After this many times", "count", tr.count, html`type="number" min="1" step="1" placeholder="e.g. 200"`)}${f("Ignore repeats within (seconds)", "debounce_seconds", tr.debounce_seconds ?? 0, html`type="number" min="0" step="any"`)}`;
        break;
      case "problem":
        fields = html`${entity}<label class="inline full"><input type="checkbox" data-tfield="auto_complete" ${tr.auto_complete ? html`checked` : ""}>Mark done automatically when the sensor recovers</label>`;
        break;
      case "salt_level":
        fields = html`<div class="full lastdone">Uses this water softener's estimated salt level and its refill warning level.</div>`;
        break;
      default:
        fields = html``;
    }
    return html`<div class="mtrigger-edit" data-trigger="${index}">
      <label class="full">Trigger<span class="toggle-group"><select data-tfield="type" data-ttype="${index}">${this._mOptions(MAINT_TRIGGERS, tr.type)}</select>
        <button type="button" class="icon-btn sm" data-action="m-trigger-remove" data-id="${index}" aria-label="Remove trigger"><ha-icon icon="mdi:close"></ha-icon></button></span></label>
      ${fields}</div>`;
  }

  _mTaskDialogHtml(d) {
    const t = d.task;
    const mb = this._mBoard();
    const people = this._board.people || [];
    const objects = (mb?.objects || []).map((o) => [o.id, `${o.name} ${o.code}`]);
    const obj = (mb?.objects || []).find((o) => o.id === t.object_id);
    const docs = (mb?.documents || []).filter((doc) => doc.object_id === t.object_id && doc.kind === "file");
    const partLinks = new Map((t.parts || []).map((p) => [p.part_id, p.quantity]));
    const parts = (mb?.parts || []).filter((p) => !p.object_id || p.object_id === t.object_id || partLinks.has(p.id));
    const scheduled = t.schedule_mode === "rolling" || t.schedule_mode === "planned";
    const rotation = new Set(t.rotation || []);
    const months = new Set(t.active_months || []);
    const action = t.on_complete_action || {};
    const admin = this._isAdmin();
    const softener = obj?.object_type === "water_softener";
    const triggerTypes = softener ? MAINT_TRIGGERS : MAINT_TRIGGERS.filter(([k]) => k !== "salt_level");
    return html`<h2><span class="grow">${t.id ? html`Edit ${t.name} <span class="mid">${t.code}</span>` : "New maintenance task"}</span>${this._closeButton()}</h2>
      <div class="form mtask-form">
        <label class="full">Task<input name="name" value="${t.name || ""}" maxlength="200" placeholder="Replace Filter" autofocus></label>
        <label>Object<select name="object_id">${this._mOptions(objects, t.object_id, objects.length ? null : "Create an object first")}</select></label>
        <label>Category<select name="category">${this._mOptions(MAINT_CATEGORIES.map((c) => [c, c]), t.category || "Service")}</select></label>
        <label>Priority<select name="priority">${this._mOptions(PRIORITIES.map((p) => [p, p[0].toUpperCase() + p.slice(1)]), t.priority || "none")}</select></label>
        <label>Spec / part note<input name="spec_note" value="${t.spec_note || ""}" maxlength="200" placeholder="16x25x4 MERV 11"></label>

        <div class="full mgroup-head"><ha-icon icon="mdi:calendar-sync"></ha-icon>Schedule</div>
        <label class="full">Repeats<select name="schedule_mode" data-mrerender>${this._mOptions(MAINT_SCHEDULES, t.schedule_mode || "rolling")}</select></label>
        ${scheduled
          ? html`<label>Every<input type="number" name="interval_value" min="1" max="1000" value="${t.interval_value ?? 3}"></label>
              <label>Unit<select name="interval_unit">${this._mOptions(MAINT_UNITS, t.interval_unit || "months")}</select></label>`
          : ""}
        ${t.schedule_mode !== "none"
          ? html`<label>Next due<input type="date" name="next_due" value="${t.next_due || ""}"></label>
              ${t.schedule_mode === "planned" ? html`<label>Anchor date<input type="date" name="anchor_date" value="${t.anchor_date || ""}"></label>` : ""}
              <label>Overdue at (time of day)<input type="time" name="schedule_time" value="${t.schedule_time || ""}"></label>`
          : ""}
        <label>Warn (days before due)<input type="number" name="warning_days" min="0" max="365" value="${t.warning_days ?? mb?.plan?.settings?.default_warning_days ?? 7}"></label>
        <label>Warn at % of a trigger<input type="number" name="warning_percent" min="0" max="100" value="${t.warning_percent ?? 90}"></label>
        <label class="full">Active months <span class="lastdone">(none = all year; e.g. only Oct–Apr for a humidifier)</span>
          <span class="mmonths">${MONTH_NAMES.map((n, i) => html`<label class="inline"><input type="checkbox" name="active_months" value="${i + 1}" ${months.has(i + 1) ? html`checked` : ""}>${n}</label>`)}</span></label>

        <div class="full mgroup-head"><ha-icon icon="mdi:access-point"></ha-icon>Sensor triggers<span class="grow"></span>
          ${(t.triggers || []).length > 1 ? html`<select name="trigger_logic" aria-label="Combine triggers">${this._mOptions([["or", "Any one is enough (OR)"], ["and", "All must be met (AND)"]], t.trigger_logic || "or")}</select>` : ""}</div>
        <div class="full mtriggers">${(t.triggers || []).map((tr, i) => this._mTriggerEditor(tr, i))}
          <span class="toggle-group"><select data-mnew-trigger aria-label="Trigger type">${this._mOptions(triggerTypes, "threshold")}</select>
            <button type="button" class="btn small flat" data-action="m-trigger-add"><ha-icon icon="mdi:plus"></ha-icon>Add trigger</button></span>
          ${this._mEntityList("m-trigger-entities", ["sensor", "binary_sensor", "climate", "switch", "input_number", "counter", "fan", "water_heater"])}</div>

        <div class="full mgroup-head"><ha-icon icon="mdi:account-arrow-right-outline"></ha-icon>Who</div>
        <label>Assigned to<select name="assigned_to">${this._mOptions(people.map((p) => [p.entity_id, p.name]), t.assigned_to, "Anyone")}</select></label>
        <label>Rotate after each completion<span class="toggle-group">${people.map(
          (p) => html`<label class="inline"><input type="checkbox" name="rotation" value="${p.entity_id}" ${rotation.has(p.entity_id) ? html`checked` : ""}>${p.name}</label>`,
        )}</span></label>

        <div class="full mgroup-head"><ha-icon icon="mdi:package-variant-closed"></ha-icon>Parts used</div>
        <div class="full">${parts.length
          ? parts.map(
              (p) => html`<div class="mpart" data-part-row="${p.id}"><label class="inline"><input type="checkbox" data-part-on ${partLinks.has(p.id) ? html`checked` : ""}>${p.part_name}</label>
                <span class="mstock ${p.low ? "low" : ""}">${p.current_stock} in stock</span>
                <input type="number" data-part-qty min="0.01" step="any" value="${partLinks.get(p.id) ?? 1}" aria-label="Quantity of ${p.part_name}" style="width:80px"></div>`,
            )
          : html`<span class="lastdone">No parts yet — add them from the object's “Parts &amp; consumables”.</span>`}</div>

        <div class="full mgroup-head"><ha-icon icon="mdi:nfc-variant"></ha-icon>NFC &amp; manual</div>
        <label>NFC tag ID<input name="nfc_tag_id" value="${t.nfc_tag_id || ""}" maxlength="128" placeholder="Scan, or paste the tag ID"></label>
        <label class="inline"><input type="checkbox" name="require_nfc" ${t.require_nfc ? html`checked` : ""}>Only complete by scanning the tag at the appliance</label>
        <label>Manual<select name="manual_doc_id">${this._mOptions(docs.map((doc) => [doc.id, doc.title]), t.manual_doc_id, "None")}</select></label>
        <label>Manual page<input type="number" name="manual_page" min="1" max="10000" value="${t.manual_page ?? ""}"></label>

        ${admin
          ? html`<div class="full mgroup-head"><ha-icon icon="mdi:play-circle-outline"></ha-icon>When completed, run (administrators)</div>
              ${t.action_paused ? html`<div class="full banner"><ha-icon icon="mdi:pause-circle-outline"></ha-icon>This action came from a restored backup and is paused. Check it, then Save to turn it back on.</div>` : ""}
              <label>Action<input name="action_service" value="${action.service || ""}" maxlength="100" placeholder="button.press"></label>
              <label>Target entity<input name="action_entity" value="${Array.isArray(action.entity_id) ? action.entity_id.join(", ") : action.entity_id || ""}" maxlength="500" placeholder="button.furnace_filter_reset" list="m-action-entities"></label>
              ${this._mEntityList("m-action-entities", ["button", "input_button", "script", "counter", "input_datetime", "switch"])}`
          : action.service
            ? html`<div class="full lastdone">${t.action_paused ? `${action.service} is paused until an administrator saves this task.` : `Runs ${action.service} when completed (only administrators can change this).`}</div>`
            : ""}
        <label class="full">Notes (Markdown)<textarea name="notes" maxlength="20000" placeholder="Steps, torque specs, where the shut-off valve is…">${t.notes || ""}</textarea></label>
      </div>
      <div class="dialog-actions">
        ${t.id ? html`<button class="btn danger" data-action="m-delete-task" data-id="${t.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        <span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="m-task-save">${t.id ? "Save" : "Create task"}</button>
      </div>`;
  }

  _mCompleteDialogHtml(d) {
    const t = d.task;
    const mb = this._mBoard();
    const people = this._board.people || [];
    const links = new Map((t.parts || []).map((p) => [p.part_id, p.quantity]));
    const parts = (mb?.parts || []).filter((p) => links.has(p.id));
    const obj = (mb?.objects || []).find((o) => o.id === t.object_id);
    const salt = obj?.object_type === "water_softener" && (t.triggers || []).some((tr) => tr.type === "salt_level") ? obj.salt || {} : null;
    const me = this._board.me || this._me();
    return html`<h2><span class="grow">Complete ${t.name} <span class="mid">${t.code}</span></span>${this._closeButton()}</h2>
      <div class="hint">${t.object_name}${t.next_due ? ` · due ${usDate(t.next_due)}` : ""}</div>
      <div class="form mcomplete-form">
        <label>Done on<input type="date" name="completed_at" value="${this._today()}" max="${this._today()}"></label>
        <label>Done by<select name="performed_by">${this._mOptions(people.map((p) => [p.entity_id, p.name]), me, "Me")}</select></label>
        <label>Duration (minutes)<input type="number" name="duration_minutes" min="0" max="10000" placeholder="e.g. 15"></label>
        <label>Cost (labor / service, ${this._mCurrency(mb)})<input type="number" name="cost" min="0" step="0.01" placeholder="0"></label>
        ${parts.length
          ? html`<div class="full"><div class="mgroup-head">Parts used (taken from stock)</div>${parts.map(
              (p) => html`<div class="mpart" data-part-row="${p.id}"><label class="inline"><input type="checkbox" data-part-on checked>${p.part_name}</label>
                <span class="mstock ${p.low ? "low" : ""}">${p.current_stock} in stock</span>
                <input type="number" data-part-qty min="0" step="any" value="${links.get(p.id)}" aria-label="Quantity of ${p.part_name}" style="width:80px"></div>`,
            )}</div>`
          : ""}
        ${salt
          ? html`<label>Salt is now at<select name="salt_level">${this._mOptions((salt.markers || []).map((v) => [v, salt.scale === "percent" ? `${v}%` : salt.scale === "bags" ? `${v} bags` : `Level ${v}`]), salt.scale === "levels" ? salt.max_level : salt.scale === "percent" ? 100 : salt.capacity_bags, "Full (top)")}</select></label>
              <label>…or bags added<input type="number" name="salt_bags" min="0.5" max="50" step="0.5" placeholder="e.g. 2"></label>`
          : ""}
        <label class="full">How was the timing?<span class="toggle-group">${[["too_early", "Too early"], ["just_right", "Just right"], ["too_late", "Too late"]].map(
          ([v, l]) => html`<label class="inline chip"><input type="radio" name="feedback" value="${v}">${l}</label>`,
        )}</span></label>
        <label class="full">Notes<textarea name="notes" maxlength="4000" placeholder="Filter was very dirty; used MERV 11…"></textarea></label>
        <label class="full mupload"><ha-icon icon="mdi:camera-outline"></ha-icon><span>Photo (optional)</span><input type="file" name="photo" accept="image/*" capture="environment"></label>
      </div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button><button class="btn" data-action="m-complete-save"><ha-icon icon="mdi:check"></ha-icon>Complete</button></div>`;
  }

  _mConfirmDialogHtml(d) {
    const t = d.task;
    return html`<h2><span class="grow">Mark as done?</span>${this._closeButton()}</h2>
      <p><strong>${t.object_name}</strong> › ${t.name} <span class="mid">${t.code}</span></p>
      <div class="hint">${t.countdown}</div>
      ${t.require_nfc ? html`<div class="banner"><ha-icon icon="mdi:nfc-variant"></ha-icon>This task can only be completed by scanning its NFC tag.</div>` : ""}
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Not now</button>
        <button class="btn" data-action="m-confirm-complete" data-id="${t.id}" ${t.require_nfc ? html`disabled` : ""}><ha-icon icon="mdi:check"></ha-icon>Complete</button></div>`;
  }

  _mPartDialogHtml(d) {
    const p = d.part;
    const mb = this._mBoard();
    const objects = (mb?.objects || []).map((o) => [o.id, `${o.name} ${o.code}`]);
    const num = (label, name, value, attrs = html``) => html`<label>${label}<input type="number" name="${name}" value="${value ?? ""}" step="any" min="0" ${attrs}></label>`;
    return html`<h2><span class="grow">${p.id ? p.part_name : "New part"}</span>${this._closeButton()}</h2>
      <div class="form mpart-form">
        <label class="full">Part name<input name="part_name" value="${p.part_name || ""}" maxlength="120" placeholder="16x25x4 Air Filter" autofocus></label>
        <label>MPN / GTIN<input name="mpn_gtin" value="${p.mpn_gtin || ""}" maxlength="64"></label>
        <label>Storage location<input name="storage_location" value="${p.storage_location || ""}" maxlength="120" placeholder="Garage shelf B"></label>
        ${num("In stock", "current_stock", p.current_stock ?? 0)}
        ${num("Reorder at or below", "reorder_threshold", p.reorder_threshold ?? 1)}
        ${num("Reorder quantity", "restock_quantity", p.restock_quantity ?? 1, html`min="1"`)}
        ${num(`Unit cost (${this._mCurrency(mb)})`, "unit_cost", p.unit_cost)}
        <label>When stock runs low<select name="restock_action">${this._mOptions([["shopping", "Add to the shopping list"], ["task", "Create a “Buy …” task"], ["none", "Do nothing"]], p.restock_action || "shopping")}</select></label>
        <label>Belongs to<select name="object_id">${this._mOptions(objects, p.object_id, "Shared across objects")}</select></label>
        <label class="full">Reorder link<input name="reorder_url" value="${p.reorder_url || ""}" maxlength="2048" placeholder="https://…"></label>
        <label class="full">Notes<input name="notes" value="${p.notes || ""}" maxlength="2000"></label>
      </div>
      <div class="dialog-actions">
        ${p.id ? html`<button class="btn danger" data-action="m-part-delete" data-id="${p.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>` : ""}
        ${p.id && safeUrl(p.reorder_url) ? html`<a class="btn flat" href="${p.reorder_url}"><ha-icon icon="mdi:open-in-new"></ha-icon>Reorder</a>` : ""}
        <span class="grow"></span>
        <button class="btn flat" data-action="dialog-close">Cancel</button>
        <button class="btn" data-action="m-part-save">Save</button>
      </div>`;
  }

  _mLinkDialogHtml(d) {
    return html`<h2><span class="grow">Add a link</span>${this._closeButton()}</h2>
      <div class="form mlink-form">
        <label class="full">Link<input name="url" type="url" maxlength="2048" placeholder="https://manufacturer.example/manual.pdf" autofocus></label>
        <label>Title<input name="title" maxlength="120" placeholder="Owner's manual"></label>
        <label>Category<select name="category">${this._mOptions(DOC_CATEGORIES_UI.map((c) => [c, c[0].toUpperCase() + c.slice(1)]), d.category || "manual")}</select></label>
      </div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button><button class="btn" data-action="m-link-save" data-id="${d.objectId}">Add link</button></div>`;
  }

  _mSaltDialogHtml(d) {
    const s = d.obj.salt || {};
    const markers = s.markers || [];
    const label = (v) => (s.scale === "percent" ? `${v}%` : s.scale === "bags" ? `${v} bags` : `Level ${v}`);
    const top = s.scale === "levels" ? s.max_level : s.scale === "percent" ? 100 : s.capacity_bags;
    return html`<h2><span class="grow">Filled salt — ${d.obj.name}</span>${this._closeButton()}</h2>
      <div class="hint">Logging a fill completes the refill task and takes the bags from stock.</div>
      <div class="form msalt-form">
        <label>Salt is now at<select name="level">${this._mOptions(markers.filter((v) => v > (s.scale === "levels" ? s.min_level : 0)).map((v) => [v, label(v)]), top)}</select></label>
        <label>…or I added (bags)<input type="number" name="bags" min="0.5" max="50" step="0.5" placeholder="leave empty to use the level"></label>
      </div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button><button class="btn" data-action="m-salt-fill-save" data-id="${d.obj.id}"><ha-icon icon="mdi:shaker"></ha-icon>Log fill</button></div>`;
  }

  _mQrDialogHtml(d) {
    const res = d.result;
    return html`<h2><span class="grow">QR code — ${d.name}</span>${this._closeButton()}</h2>
      ${d.qrKind === "task"
        ? html`<div class="toggle-group"><button class="chip ${d.action === "open" ? "on" : ""}" data-action="m-qr-mode" data-id="open">Opens the task</button>
            <button class="chip ${d.action === "complete" ? "on" : ""}" data-action="m-qr-mode" data-id="complete">Quick-complete</button></div>`
        : ""}
      <div class="mqr">
        <div class="qr-slot">${res ? "" : html`<div class="empty sm">Generating…</div>`}</div>
        ${res ? html`<div class="url">${res.url}</div>` : ""}
        ${res && !/^https?:/i.test(res.url) ? html`<div class="lastdone">Set your Home Assistant URL (Settings → System → Network) so phones can open this code.</div>` : ""}
      </div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Close</button>
        <button class="btn flat" data-action="m-qr-print" ${res ? "" : html`disabled`}><ha-icon icon="mdi:printer-outline"></ha-icon>Print label</button>
        <button class="btn" data-action="m-qr-download" ${res ? "" : html`disabled`}><ha-icon icon="mdi:download"></ha-icon>Download PNG</button></div>`;
  }

  _mTemplateDialogHtml(d) {
    const mb = this._mBoard();
    return html`<h2><span class="grow">Start from a template</span>${this._closeButton()}</h2>
      <div class="hint">Creates the object with its usual tasks, intervals and parts. You can change everything afterwards.</div>
      <div class="snooze-grid mtemplates">${(mb?.templates || []).map(
        (tpl) => html`<button data-action="m-template-apply" data-id="${tpl.id}"><ha-icon icon="${tpl.icon || "mdi:cube-outline"}"></ha-icon><span>${tpl.name}<small>${tpl.tasks.join(" · ")}</small></span></button>`,
      )}</div>
      <div class="dialog-actions"><button class="btn flat" data-action="dialog-close">Cancel</button></div>`;
  }

  /** Draw a QR matrix (rows of "1"/"0") into the dialog with the DOM API — no markup strings. */
  _mMountQr() {
    const d = this._dialog;
    const slot = this.shadowRoot.querySelector(".qr-slot");
    if (!slot || !d?.result) return;
    const rows = d.result.rows;
    const quiet = 4;
    const scale = 8;
    const size = (rows.length + quiet * 2) * scale;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) if (row[x] === "1") ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    });
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `QR code for ${d.name}`);
    slot.replaceChildren(canvas);
  }

  /* ---------------- Maintenance: My Day & tab badges ---------------- */

  _maintCount(planId) {
    const s = this._board?.maintenance?.[planId];
    return s ? s.overdue + s.due_soon + s.triggered : 0;
  }

  _maintAttention(me) {
    const items = [];
    for (const entry of Object.values(this._board?.maintenance || {})) {
      for (const item of entry.attention || []) if (!item.assigned_to || item.assigned_to === me) items.push(item);
    }
    return items.sort((a, b) => (MAINT_STATUS[b.status]?.rank || 0) - (MAINT_STATUS[a.status]?.rank || 0) || String(a.due || "9").localeCompare(String(b.due || "9")));
  }

  _maintAttentionHtml(items) {
    if (!items.length) return html``;
    return html`<div class="section"><div class="section-head"><ha-icon icon="mdi:tools"></ha-icon>Home maintenance <span class="badge">${items.length}</span></div>
      ${items.map(
        (a) => html`<div class="mattn">${this._mPill(a.status)}
          <button class="mlink grow" data-action="m-goto" data-plan="${a.plan_id}" data-id="${a.id}"><strong>${a.name}</strong> · ${a.object_name} <span class="mcode">${a.code}</span><div class="lastdone">${a.countdown}</div></button>
          <button class="mbtn ok" data-action="m-complete" data-id="${a.id}" ${a.require_nfc ? html`disabled title="Scan the NFC tag at the appliance"` : ""}><ha-icon icon="mdi:check"></ha-icon>Complete</button></div>`,
      )}</div>`;
  }

  /* ---------------- Maintenance: actions ---------------- */

  _mRefresh() {
    const planId = this._mPlanId();
    if (planId) this._queueMaintLoad(planId);
  }

  _mNavigate(changes) {
    const ui = this._ui.maint;
    Object.assign(ui, { addMenu: false, headMenu: false, search: false }, changes);
    if (changes.taskId !== undefined || changes.objectId !== undefined) {
      ui.taskTab = "overview";
      const top = this.shadowRoot.querySelector(".td-body");
      if (top?.scrollIntoView && (ui.taskId || ui.objectId)) top.scrollIntoView({ block: "start" });
    }
    this._renderBody();
    if (ui.taskId || ui.objectId) this._mLoadHistory();
  }

  async _mLoadHistory() {
    const ui = this._ui.maint;
    const key = ui.taskId || ui.objectId;
    if (!key) return;
    try {
      const events = await this._store.call({ type: "taskdragon/maint_history", ...(ui.taskId ? { task_id: ui.taskId } : { object_id: ui.objectId }), limit: 1000 });
      this._mHistory = { ...(this._mHistory || {}), [key]: events };
      if ((ui.taskId || ui.objectId) === key) this._renderBody();
    } catch (_err) {
      /* the board's recent events are shown instead */
    }
  }

  _mTaskById(id) {
    const mb = this._mBoard();
    const task = mb ? this._mIdx(mb).tasks.get(id) : null;
    if (task) return task;
    for (const entry of Object.values(this._board?.maintenance || {})) {
      const item = (entry.attention || []).find((a) => a.id === id);
      if (item) return item;
    }
    return null;
  }

  async _maintAction(action, el, event) {
    const id = el.dataset.id;
    const ui = this._ui.maint;
    const planId = this._mPlanId();
    const mb = this._mBoard();
    const idx = mb ? this._mIdx(mb) : null;
    switch (action) {
      case "m-retry":
        this._maintError = null;
        return this._loadMaint(id);
      case "m-tile":
        return this._mNavigate(id === "objects" ? { view: "objects", taskId: null, objectId: null } : { view: "dashboard", filter: id, taskId: null, objectId: null });
      case "m-view":
        return this._mNavigate({ view: id, taskId: null, objectId: null });
      case "m-search":
        ui.search = !ui.search;
        if (!ui.search) ui.query = "";
        this._renderBody();
        if (ui.search) this.shadowRoot.querySelector("[data-msearch]")?.focus();
        return;
      case "m-task":
        if (!id) return;
        return this._mNavigate({ taskId: id, objectId: null });
      case "m-object":
        return this._mNavigate({ objectId: id, taskId: null, histTask: "", histFrom: "", histTo: "" });
      case "m-back":
        return this._mNavigate({ taskId: null, objectId: null });
      case "m-goto":
        this._ui.tab = el.dataset.plan;
        Object.assign(ui, { taskId: id, objectId: null, view: "dashboard", search: false, taskTab: "overview" });
        this._render();
        this._queueMaintLoad(el.dataset.plan);
        return this._mLoadHistory();
      case "m-area":
        return this._mNavigate({ area: id, view: "dashboard", filter: "all", taskId: null, objectId: null });
      case "m-clear-area":
        ui.area = null;
        return this._renderBody();
      case "m-task-tab":
        ui.taskTab = id;
        return this._renderBody();
      case "m-acc":
        ui.open[id] = ui.open[id] === false;
        return this._renderBody();
      case "m-add-menu":
        ui.addMenu = !ui.addMenu;
        ui.headMenu = false;
        return this._renderBody();
      case "m-head-menu":
        ui.headMenu = !ui.headMenu;
        ui.addMenu = false;
        return this._renderBody();
      case "m-select-mode":
        ui.select = !ui.select;
        ui.selected.clear();
        return this._renderBody();
      case "m-select":
        if (el.checked) ui.selected.add(id);
        else ui.selected.delete(id);
        return this._renderBody();
      case "m-bulk":
        return this._mBulk(id);
      case "m-save-view": {
        const name = prompt("Name this view", ui.filter !== "all" ? MAINT_STATUS[ui.filter]?.label || "" : "");
        if (!name || !name.trim()) return;
        const views = (this._board.prefs?.maint_views || []).filter((v) => v.name !== name.trim());
        views.push({ name: name.trim(), filter: ui.filter, user: ui.user, priority: ui.priority, sort: ui.sort, group: ui.group });
        await this._savePrefs({ maint_views: views.slice(-30) });
        this._renderBody();
        return this._showToast(`Saved view “${name.trim()}”`);
      }
      case "m-cal":
        ui.calMonth = id;
        return this._renderBody();

      /* Completing & skipping */
      case "m-complete":
        return this._mComplete(id);
      case "m-complete-dialog": {
        const task = idx?.tasks.get(id);
        if (task) this._openDialog({ kind: "maint-complete", task });
        return;
      }
      case "m-complete-save":
        return this._mCompleteSave();
      case "m-confirm-complete":
        this._closeDialog();
        return this._mComplete(id, { method: "qr" });
      case "m-skip": {
        const task = this._mTaskById(id);
        const res = await this._call({ type: "taskdragon/maint_skip", task_id: id });
        this._mRefresh();
        return this._showToast(`${res.kind === "missed" ? "Marked missed" : "Skipped"}: ${task?.name || "task"}`);
      }

      /* Objects */
      case "m-new-object":
        return this._openDialog({ kind: "maint-object", obj: { plan_id: planId, object_type: "generic", warranty_reminder_days: 30, config: {} } });
      case "m-new-child": {
        const parent = idx?.objects.get(id);
        return this._openDialog({ kind: "maint-object", obj: { plan_id: planId, object_type: "generic", parent_object_id: id, area_id: parent?.area_id || null, warranty_reminder_days: 30, config: {} } });
      }
      case "m-edit-object": {
        const obj = idx?.objects.get(id);
        if (obj) this._openDialog({ kind: "maint-object", obj: JSON.parse(JSON.stringify(obj)) });
        return;
      }
      case "m-object-save":
        return this._mObjectSave();
      case "m-delete-object": {
        const obj = idx?.objects.get(id);
        if (!confirm(`Delete “${obj?.name || "this object"}” with its tasks, parts, documents and history?`)) return;
        const res = await this._call({ type: "taskdragon/maint_delete_object", object_id: id });
        if (this._dialog) this._closeDialog();
        this._mNavigate({ objectId: null, taskId: null });
        this._mRefresh();
        return this._showToast("Object deleted", this._undoWith(res.undo));
      }

      /* Tasks */
      case "m-new-task": {
        const objectId = id || ui.objectId || mb?.objects[0]?.id || null;
        if (!objectId) {
          this._showToast("Add an object first — tasks belong to an appliance or system");
          return this._openDialog({ kind: "maint-object", obj: { plan_id: planId, object_type: "generic", warranty_reminder_days: 30, config: {} } });
        }
        return this._openDialog({
          kind: "maint-task",
          task: {
            object_id: objectId,
            category: "Service",
            priority: "none",
            schedule_mode: "rolling",
            interval_value: 3,
            interval_unit: "months",
            warning_days: mb?.plan?.settings?.default_warning_days ?? 7,
            warning_percent: 90,
            triggers: [],
            trigger_logic: "or",
            parts: [],
            rotation: [],
            active_months: [],
          },
        });
      }
      case "m-edit-task": {
        const task = idx?.tasks.get(id);
        if (task) this._openDialog({ kind: "maint-task", task: JSON.parse(JSON.stringify(task)) });
        return;
      }
      case "m-task-save":
        return this._mTaskSave();
      case "m-delete-task": {
        const task = idx?.tasks.get(id);
        if (!confirm(`Delete “${task?.name || "this task"}” and its history?`)) return;
        const res = await this._call({ type: "taskdragon/maint_delete_task", task_id: id });
        if (this._dialog) this._closeDialog();
        if (ui.taskId === id) this._mNavigate({ taskId: null });
        this._mRefresh();
        return this._showToast("Task deleted", this._undoWith(res.undo));
      }
      case "m-trigger-add": {
        this._mSyncTaskDraft();
        const type = this.shadowRoot.querySelector("[data-mnew-trigger]")?.value || "threshold";
        this._dialog.task.triggers = [...(this._dialog.task.triggers || []), { type }];
        if (this._dialog.task.schedule_mode === "rolling" && !this._dialog.task.id && this._dialog.task.triggers.length === 1) this._dialog.task.schedule_mode = "none";
        return this._renderDialog();
      }
      case "m-trigger-remove":
        this._mSyncTaskDraft();
        this._dialog.task.triggers.splice(Number(id), 1);
        return this._renderDialog();
      case "m-nfc-listen": {
        ui.headMenu = false;
        const res = await this._call({ type: "taskdragon/maint_nfc_listen", task_id: id });
        this._mRefresh();
        return this._showToast(`Scan the NFC tag now (until ${fmtTime(new Date(res.expires))})`);
      }
      case "m-apply-rec": {
        const res = await this._call({ type: "taskdragon/maint_recommendation", task_id: id, apply: true });
        this._mRefresh();
        return this._showToast(`Interval set to every ${res.task.interval_value} ${res.task.interval_unit}`);
      }
      case "m-reanalyze": {
        const res = await this._call({ type: "taskdragon/maint_recommendation", task_id: id });
        const task = idx?.tasks.get(id);
        if (task) task.recommendation = res.recommendation;
        this._renderBody();
        return this._showToast(res.recommendation ? "Re-analyzed your completion history" : "Not enough history yet — complete it a couple more times");
      }

      /* Templates & battery fleet */
      case "m-templates":
        return this._openDialog({ kind: "maint-template" });
      case "m-template-apply": {
        this._closeDialog();
        const obj = await this._call({ type: "taskdragon/maint_apply_template", plan_id: planId, template_id: id });
        await this._loadMaint(planId);
        this._mNavigate({ objectId: obj.id, taskId: null });
        return this._showToast(`Added ${obj.name}`);
      }
      case "m-fleet": {
        ui.addMenu = false;
        if (!confirm("Scan Home Assistant for battery-powered devices and add a “Replace Battery” task for each one (triggered below 15%)?")) return this._renderBody();
        const res = await this._call({ type: "taskdragon/maint_battery_fleet", plan_id: planId });
        await this._loadMaint(planId);
        this._mNavigate({ objectId: res.object_id, taskId: null });
        return this._showToast(res.created ? `Added ${res.created} battery task${res.created === 1 ? "" : "s"}` : "Every battery is already tracked");
      }

      /* Parts */
      case "m-new-part":
        return this._openDialog({ kind: "maint-part", part: { plan_id: planId, object_id: id || null, current_stock: 0, reorder_threshold: 1, restock_quantity: 1, restock_action: "shopping" } });
      case "m-part-edit": {
        const part = idx?.parts.get(id);
        if (part) this._openDialog({ kind: "maint-part", part: { ...part } });
        return;
      }
      case "m-part-save":
        return this._mPartSave();
      case "m-part-delete": {
        if (!confirm("Delete this part? Tasks stop using it.")) return;
        const res = await this._call({ type: "taskdragon/maint_delete_part", part_id: id });
        this._closeDialog();
        this._mRefresh();
        return this._showToast("Part deleted", this._undoWith(res.undo));
      }
      case "m-stock": {
        const part = await this._call({ type: "taskdragon/maint_adjust_stock", part_id: id, delta: Number(el.dataset.delta) });
        this._mRefresh();
        const low = part.restock_action !== "none" && Number(part.current_stock) <= Number(part.reorder_threshold);
        return this._showToast(`${part.part_name}: ${part.current_stock} in stock${low ? (part.restock_action === "task" ? " · “Buy” task added" : " · on the shopping list") : ""}`);
      }

      /* Documents */
      case "m-add-link":
        return this._openDialog({ kind: "maint-link", objectId: id, category: ui.docCat });
      case "m-link-save": {
        const form = this.shadowRoot.querySelector(".mlink-form");
        const url = form.querySelector('[name="url"]').value.trim();
        if (!safeUrl(url) || !/^https?:/i.test(url)) return this._showToast("Links must start with http:// or https://");
        await this._call({ type: "taskdragon/maint_add_link", object_id: id, url, title: form.querySelector('[name="title"]').value.trim() || null, category: form.querySelector('[name="category"]').value });
        this._closeDialog();
        this._mRefresh();
        return this._showToast("Link added");
      }
      case "m-doc-open":
        return this._mOpenDocument(id, el.dataset.page);
      case "m-doc-delete": {
        const doc = mb?.documents.find((d) => d.id === id);
        if (!confirm(`Delete “${doc?.title || "this document"}”?`)) return;
        const res = await this._call({ type: "taskdragon/maint_delete_document", document_id: id });
        this._mRefresh();
        return this._showToast("Document deleted", this._undoWith(res.undo));
      }
      case "m-pdf":
        ui.headMenu = false;
        return this._mOpenSigned(this._mServiceRecordPath(id));

      /* Water softener */
      case "m-salt-fill": {
        const obj = idx?.objects.get(id);
        if (obj) this._openDialog({ kind: "maint-salt", obj });
        return;
      }
      case "m-salt-fill-save": {
        const form = this.shadowRoot.querySelector(".msalt-form");
        const bags = form.querySelector('[name="bags"]').value;
        const level = form.querySelector('[name="level"]').value;
        const res = await this._call({ type: "taskdragon/maint_salt_log", object_id: id, kind: "fill", ...(bags ? { bags: Number(bags) } : { level: Number(level) }) });
        this._closeDialog();
        this._mRefresh();
        return this._showToast("Salt fill logged", this._undoWith(res.undo));
      }
      case "m-salt-level": {
        await this._call({ type: "taskdragon/maint_salt_log", object_id: id, kind: "level", level: Number(el.dataset.level) });
        this._mRefresh();
        return this._showToast(`Logged salt at ${el.textContent.trim()} — the estimate recalibrates`);
      }
      case "m-salt-empty": {
        if (!confirm("Log the tank as empty (and salt bridges checked)?")) return;
        await this._call({ type: "taskdragon/maint_salt_log", object_id: id, kind: "empty" });
        this._mRefresh();
        return this._showToast("Logged an empty tank — time to fill");
      }

      /* QR codes */
      case "m-qr": {
        ui.headMenu = false;
        this._renderBody();
        const kind = el.dataset.kind;
        const target = kind === "task" ? idx?.tasks.get(id) : idx?.objects.get(id);
        const dialog = { kind: "maint-qr", qrKind: kind, id, name: target ? `${target.name} ${target.code}` : "", action: "open", result: null };
        this._openDialog(dialog);
        return this._mLoadQr(dialog);
      }
      case "m-qr-mode": {
        const dialog = this._dialog;
        dialog.action = id;
        dialog.result = null;
        this._renderDialog();
        return this._mLoadQr(dialog);
      }
      case "m-qr-download":
        return this._mQrDownload();
      case "m-qr-print":
        return this._mQrPrint();

      /* Settings */
      case "m-save-settings": {
        const form = this.shadowRoot.querySelector(".msettings-form");
        const val = (name) => form.querySelector(`[name="${name}"]`)?.value ?? "";
        const settings = {
          cost_mode: val("cost_mode"),
          currency: val("currency").trim() || "$",
          default_warning_days: Number(val("default_warning_days") || 7),
          shopping_plan_id: val("shopping_plan_id") || null,
          chore_plan_id: val("chore_plan_id") || null,
        };
        if (this._isAdmin()) settings.notify_service = val("notify_service").trim() || null;
        await this._call({ type: "taskdragon/maint_save_settings", plan_id: planId, settings });
        this._mRefresh();
        return this._showToast("Maintenance settings saved");
      }
      default:
        return;
    }
  }

  /** Change events from maintenance controls; true when handled. */
  _maintChange(el) {
    const data = el.dataset || {};
    const ui = this._ui.maint;
    const dialog = this._dialog;
    if (data.mfilter) {
      if (data.mfilter === "view") {
        const view = (this._board.prefs?.maint_views || [])[Number(el.value)];
        if (!view) return true;
        Object.assign(ui, { filter: view.filter || "all", user: view.user || "all", priority: view.priority || "all", sort: view.sort || "due", group: view.group || "none" });
      } else {
        ui[data.mfilter] = el.value;
      }
      this._renderBody();
      return true;
    }
    if (data.mbulk) {
      const value = el.value;
      el.value = "";
      if (value) this._mBulk(data.mbulk, value === "__none" ? null : value);
      return true;
    }
    if (data.mhist) {
      ui[{ task: "histTask", from: "histFrom", to: "histTo" }[data.mhist]] = el.value;
      this._renderBody();
      return true;
    }
    if (data.mdocCat !== undefined) {
      ui.docCat = el.value;
      return true;
    }
    if (data.mupload) {
      this._mUploadFromInput(el);
      return true;
    }
    if (dialog?.kind === "maint-object" && el.name === "object_type") {
      dialog.obj = { ...dialog.obj, ...this._mReadObjectForm(), object_type: el.value };
      this._renderDialog();
      return true;
    }
    if (dialog?.kind === "maint-task" && (data.mrerender !== undefined || data.ttype !== undefined || el.name === "object_id")) {
      this._mSyncTaskDraft();
      this._renderDialog();
      return true;
    }
    return false;
  }

  async _mComplete(taskId, extra = {}) {
    const task = this._mTaskById(taskId);
    const res = await this._call({ type: "taskdragon/maint_complete", task_id: taskId, ...extra });
    this._mRefresh();
    this._showToast(`Done: ${task?.name || "task"}${res.next_due ? ` · next due ${usDate(res.next_due)}` : ""}`, this._undoWith(res.undo));
  }

  async _mCompleteSave() {
    const d = this._dialog;
    const form = this.shadowRoot.querySelector(".mcomplete-form");
    const val = (name) => form.querySelector(`[name="${name}"]`)?.value ?? "";
    const message = { type: "taskdragon/maint_complete", task_id: d.task.id };
    const day = val("completed_at");
    if (day && day !== this._today()) message.completed_at = day;
    if (val("performed_by")) message.performed_by = val("performed_by");
    if (val("duration_minutes")) message.duration_minutes = Number(val("duration_minutes"));
    if (val("cost")) message.cost = Number(val("cost"));
    if (val("notes").trim()) message.notes = val("notes").trim();
    const feedback = form.querySelector('[name="feedback"]:checked');
    if (feedback) message.feedback = feedback.value;
    const rows = [...form.querySelectorAll("[data-part-row]")];
    if (rows.length) {
      message.parts = rows.map((row) => ({ part_id: row.dataset.partRow, quantity: row.querySelector("[data-part-on]").checked ? Number(row.querySelector("[data-part-qty]").value || 0) : 0 }));
    }
    if (form.querySelector('[name="salt_level"]')) {
      const bags = val("salt_bags");
      const level = val("salt_level");
      message.salt = bags ? { bags: Number(bags) } : level ? { level: Number(level) } : {};
    }
    const photo = form.querySelector('[name="photo"]')?.files?.[0];
    const button = this.shadowRoot.querySelector('[data-action="m-complete-save"]');
    if (button) button.disabled = true;
    try {
      if (photo) {
        const doc = await this._mUpload(d.task.object_id, photo, { category: "photo", taskId: d.task.id, title: `${d.task.name} — ${usDate(day || this._today())}` });
        if (doc) message.photo_doc_id = doc.id;
      }
      const res = await this._store.call(message);
      this._closeDialog();
      this._mRefresh();
      this._mLoadHistory();
      this._showToast(`Done: ${d.task.name}${res.next_due ? ` · next due ${usDate(res.next_due)}` : ""}`, this._undoWith(res.undo));
    } catch (err) {
      if (button) button.disabled = false;
      this._fail(err);
    }
  }

  _mReadObjectForm() {
    const form = this.shadowRoot.querySelector(".mobject-form");
    if (!form) return {};
    const val = (name) => (form.querySelector(`[name="${name}"]`)?.value ?? "").trim();
    const o = {
      name: val("name"),
      manufacturer_model: val("manufacturer_model") || null,
      object_type: val("object_type") || "generic",
      area_id: val("area_id") || null,
      zone_entity_id: val("zone_entity_id") || null,
      parent_object_id: val("parent_object_id") || null,
      icon: val("icon") || null,
      installed_date: val("installed_date") || null,
      warranty_expiry_date: val("warranty_expiry_date") || null,
      warranty_reminder_days: val("warranty_reminder_days") === "" ? null : Number(val("warranty_reminder_days")),
      notes: form.querySelector('[name="notes"]')?.value || null,
    };
    if (form.querySelector('[name="cfg_scale"]')) {
      const config = {};
      for (const input of form.querySelectorAll('[name^="cfg_"]')) {
        const value = input.value.trim();
        if (value !== "") config[input.name.slice(4)] = input.type === "number" ? Number(value) : value;
      }
      o.config = config;
    } else if (o.object_type === "water_softener") {
      o.config = this._dialog?.obj?.config || {};
    }
    return o;
  }

  async _mObjectSave() {
    const d = this._dialog;
    const fields = this._mReadObjectForm();
    if (!fields.name) return this._showToast("An object needs a name");
    const payload = { ...fields };
    if (d.obj.id) payload.id = d.obj.id;
    else payload.plan_id = d.obj.plan_id;
    if (payload.object_type !== "water_softener") delete payload.config;
    try {
      const saved = await this._store.call({ type: "taskdragon/maint_save_object", object: payload });
      this._closeDialog();
      await this._loadMaint(saved.plan_id);
      if (!d.obj.id) this._mNavigate({ objectId: saved.id, taskId: null });
      this._showToast(d.obj.id ? "Saved" : `Added ${saved.name}${saved.object_type === "water_softener" ? " · salt tracking is on" : ""}`);
    } catch (err) {
      this._fail(err);
    }
  }

  _mReadTaskForm() {
    const form = this.shadowRoot.querySelector(".mtask-form");
    if (!form) return {};
    const val = (name) => form.querySelector(`[name="${name}"]`)?.value ?? null;
    const has = (name) => !!form.querySelector(`[name="${name}"]`);
    const num = (value) => (value === null || value === "" ? null : Number(value));
    const checked = (name) => [...form.querySelectorAll(`[name="${name}"]:checked`)].map((n) => n.value);
    const draft = this._dialog?.task || {};
    const t = {
      name: (val("name") || "").trim(),
      object_id: val("object_id") || null,
      category: val("category"),
      priority: val("priority"),
      spec_note: (val("spec_note") || "").trim() || null,
      schedule_mode: val("schedule_mode"),
      warning_days: num(val("warning_days")),
      warning_percent: num(val("warning_percent")),
      active_months: checked("active_months").map(Number),
      trigger_logic: has("trigger_logic") ? val("trigger_logic") : draft.trigger_logic || "or",
      assigned_to: val("assigned_to") || null,
      rotation: checked("rotation"),
      nfc_tag_id: (val("nfc_tag_id") || "").trim() || null,
      require_nfc: !!form.querySelector('[name="require_nfc"]')?.checked,
      manual_doc_id: val("manual_doc_id") || null,
      manual_page: num(val("manual_page")),
      notes: val("notes") || null,
    };
    if (has("interval_value")) {
      t.interval_value = num(val("interval_value"));
      t.interval_unit = val("interval_unit");
    }
    if (has("next_due")) t.next_due = val("next_due") || null;
    if (has("anchor_date")) t.anchor_date = val("anchor_date") || null;
    if (has("schedule_time")) t.schedule_time = val("schedule_time") || null;
    t.triggers = [...form.querySelectorAll(".mtrigger-edit")].map((block) => {
      const previous = (draft.triggers || [])[Number(block.dataset.trigger)] || {};
      const trigger = previous.id ? { id: previous.id } : {};
      for (const input of block.querySelectorAll("[data-tfield]")) {
        const key = input.dataset.tfield;
        if (input.type === "checkbox") trigger[key] = input.checked;
        else if (input.type === "number") trigger[key] = num(input.value);
        else trigger[key] = input.value.trim() || null;
      }
      return trigger;
    });
    t.parts = [...form.querySelectorAll("[data-part-row]")]
      .filter((row) => row.querySelector("[data-part-on]").checked)
      .map((row) => ({ part_id: row.dataset.partRow, quantity: num(row.querySelector("[data-part-qty]").value) || 1 }));
    if (has("action_service")) {
      const service = (val("action_service") || "").trim();
      const entities = (val("action_entity") || "").split(",").map((s) => s.trim()).filter(Boolean);
      t.on_complete_action = service ? { service, ...(entities.length ? { entity_id: entities.length === 1 ? entities[0] : entities } : {}) } : null;
    }
    return t;
  }

  _mSyncTaskDraft() {
    if (this._dialog?.kind !== "maint-task") return;
    this._dialog.task = { ...this._dialog.task, ...this._mReadTaskForm() };
  }

  async _mTaskSave() {
    const d = this._dialog;
    const fields = this._mReadTaskForm();
    if (!fields.name) return this._showToast("A task needs a name");
    if (!fields.object_id) return this._showToast("Pick the object this task belongs to");
    if (fields.schedule_mode === "once" && !fields.next_due) return this._showToast("A one-time task needs a due date");
    if (fields.schedule_mode === "none" && !fields.triggers.length) return this._showToast("Without a schedule, add at least one sensor trigger");
    const payload = { ...fields };
    if (d.task.id) payload.id = d.task.id;
    if (!this._isAdmin()) delete payload.on_complete_action;
    try {
      const saved = await this._store.call({ type: "taskdragon/maint_save_task", task: payload });
      this._closeDialog();
      await this._loadMaint(this._mPlanId());
      if (!d.task.id) this._mNavigate({ taskId: saved.id, objectId: null });
      this._showToast(d.task.id ? "Saved" : `Added ${saved.name}`);
    } catch (err) {
      this._fail(err);
    }
  }

  async _mPartSave() {
    const d = this._dialog;
    const form = this.shadowRoot.querySelector(".mpart-form");
    const val = (name) => (form.querySelector(`[name="${name}"]`)?.value ?? "").trim();
    const num = (name) => (val(name) === "" ? null : Number(val(name)));
    const part = {
      part_name: val("part_name"),
      mpn_gtin: val("mpn_gtin") || null,
      storage_location: val("storage_location") || null,
      current_stock: num("current_stock") ?? 0,
      reorder_threshold: num("reorder_threshold") ?? 0,
      restock_quantity: num("restock_quantity") ?? 1,
      unit_cost: num("unit_cost"),
      restock_action: val("restock_action"),
      object_id: val("object_id") || null,
      reorder_url: val("reorder_url") || null,
      notes: val("notes") || null,
    };
    if (!part.part_name) return this._showToast("A part needs a name");
    if (part.reorder_url && !/^https?:\/\//i.test(part.reorder_url)) return this._showToast("Reorder links must start with http:// or https://");
    if (d.part.id) part.id = d.part.id;
    else part.plan_id = d.part.plan_id;
    try {
      await this._store.call({ type: "taskdragon/maint_save_part", part });
      this._closeDialog();
      this._mRefresh();
      this._showToast(d.part.id ? "Part saved" : `Added ${part.part_name}`);
    } catch (err) {
      this._fail(err);
    }
  }

  async _mBulk(action, value = null) {
    const ui = this._ui.maint;
    const ids = [...ui.selected];
    if (!ids.length) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} task${ids.length === 1 ? "" : "s"} and their history?`)) return;
    const res = await this._call({ type: "taskdragon/maint_bulk", task_ids: ids, action, value });
    ui.selected.clear();
    this._mRefresh();
    const verb = { complete: "Completed", skip: "Skipped", delete: "Deleted", assign: "Reassigned", priority: "Updated" }[action] || "Updated";
    this._showToast(`${verb} ${res.count}${res.errors.length ? ` · ${res.errors.length} not changed: ${res.errors[0].message}` : ""}`);
  }

  /* ---------------- Maintenance: files, PDFs & QR ---------------- */

  async _mUpload(objectId, file, { category = "other", taskId = null, title = null } = {}) {
    if (!file) return null;
    if (file.size > 15 * 1024 * 1024) throw new Error("Files can be at most 15 MB");
    const body = new FormData();
    body.append("object_id", objectId);
    body.append("category", category);
    if (taskId) body.append("task_id", taskId);
    if (title) body.append("title", title);
    body.append("file", file, file.name || "upload");
    const response = await this._hass.fetchWithAuth("/api/taskdragon/documents", { method: "POST", body });
    let result = null;
    try {
      result = await response.json();
    } catch (_err) {
      /* not JSON */
    }
    if (!response.ok) throw new Error(result?.message || `Upload failed (${response.status})`);
    return result;
  }

  async _mUploadFromInput(input) {
    const file = input.files?.[0];
    const objectId = input.dataset.mupload;
    input.value = "";
    if (!file) return;
    const category = input.hasAttribute("capture") ? "photo" : this._ui.maint.docCat;
    this._showToast(`Uploading ${file.name || "photo"}…`);
    try {
      const doc = await this._mUpload(objectId, file, { category });
      this._mRefresh();
      this._showToast(`Saved ${doc.title || doc.filename}`);
    } catch (err) {
      this._fail(err);
    }
  }

  _mServiceRecordPath(objectId) {
    const ui = this._ui.maint;
    const params = new URLSearchParams();
    if (ui.objectId === objectId) {
      if (ui.histFrom) params.set("from", ui.histFrom);
      if (ui.histTo) params.set("to", ui.histTo);
      if (ui.histTask) params.set("task", ui.histTask);
    }
    const query = params.toString();
    return `/api/taskdragon/service_record/${encodeURIComponent(objectId)}${query ? `?${query}` : ""}`;
  }

  /** Open an authenticated download in a new tab via a short-lived signed path (signed right before it opens). */
  async _mOpenSigned(path, hash = "", expires = 60) {
    // Open the tab synchronously (inside the click) so pop-up blockers allow it.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    try {
      const signed = await this._store.call({ type: "auth/sign_path", path, expires });
      const url = `${signed.path}${hash}`;
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      if (win) win.close();
      this._fail(err);
    }
  }

  _mOpenDocument(docId, page) {
    const mb = this._mBoard();
    const doc = mb?.documents.find((d) => d.id === docId);
    if (!doc) return;
    if (doc.kind === "link") {
      const url = safeUrl(doc.url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const hash = page && doc.content_type === "application/pdf" ? `#page=${Number(page)}` : "";
    return this._mOpenSigned(`/api/taskdragon/documents/${encodeURIComponent(doc.id)}`, hash);
  }

  async _mLoadQr(dialog) {
    try {
      const res = await this._store.call({
        type: "taskdragon/maint_qr",
        ...(dialog.qrKind === "task" ? { task_id: dialog.id, action: dialog.action } : { object_id: dialog.id }),
        origin: window.location.origin,
      });
      if (this._dialog !== dialog) return;
      dialog.result = res;
      this._renderDialog();
    } catch (err) {
      this._fail(err);
    }
  }

  _mQrDataUrl() {
    return this.shadowRoot.querySelector(".qr-slot canvas")?.toDataURL("image/png") || null;
  }

  _mQrDownload() {
    const data = this._mQrDataUrl();
    if (!data) return;
    const link = document.createElement("a");
    link.href = data;
    link.download = `taskdragon-${(this._dialog.name || "qr").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
    this.shadowRoot.append(link);
    link.click();
    link.remove();
  }

  _mQrPrint() {
    const data = this._mQrDataUrl();
    if (!data) return;
    const win = window.open("", "_blank");
    if (!win) return this._showToast("Allow pop-ups to print the label");
    const doc = win.document;
    doc.title = `QR — ${this._dialog.name}`;
    const wrap = doc.createElement("div");
    wrap.style.cssText = "font-family:sans-serif;text-align:center;padding:12mm";
    const img = doc.createElement("img");
    img.alt = this._dialog.name;
    img.style.cssText = "width:50mm;height:50mm;image-rendering:pixelated";
    const caption = doc.createElement("div");
    caption.textContent = this._dialog.name;
    caption.style.cssText = "font-size:12pt;margin-top:3mm;font-weight:600";
    const hint = doc.createElement("div");
    hint.textContent = this._dialog.action === "complete" ? "Scan to mark as done" : "Scan for maintenance details";
    hint.style.cssText = "font-size:9pt;color:#555";
    wrap.append(img, caption, hint);
    doc.body.append(wrap);
    img.onload = () => {
      win.focus();
      win.print();
    };
    img.src = data;
  }

  /* ---------------- Maintenance: deep links (QR codes) ---------------- */

  async _mDeepLink() {
    if (this._mLinked || !this.hasAttribute("panel")) return;
    this._mLinked = true;
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get("maint_task");
    const objectId = params.get("maint_object");
    if (!taskId && !objectId) return;
    const wantsComplete = params.get("do") === "complete";
    for (const key of ["maint_task", "maint_object", "do"]) params.delete(key);
    const query = params.toString();
    // Drop the parameters so reloading the page doesn't repeat a quick-complete.
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    for (const plan of this._activePlans().filter((p) => p.archetype === "home_maintenance")) {
      const mb = await this._loadMaint(plan.id);
      if (!mb) continue;
      const idx = this._mIdx(mb);
      const task = taskId ? idx.tasks.get(taskId) : null;
      const obj = objectId ? idx.objects.get(objectId) : null;
      if (!task && !obj) continue;
      this._ui.tab = plan.id;
      Object.assign(this._ui.maint, { taskId: task ? task.id : null, objectId: task ? null : obj.id, search: false, taskTab: "overview" });
      this._render();
      this._mLoadHistory();
      if (task && wantsComplete) this._openDialog({ kind: "maint-confirm", task });
      return;
    }
    this._showToast("That maintenance item isn't available — it was deleted or isn't shared with you");
  }

  /* ---------------- Actions ---------------- */

  async _call(message) {
    try {
      return await this._store.call(message);
    } catch (err) {
      this._fail(err);
      throw err;
    }
  }

  async _savePrefs(changes) {
    this._store.patchPrefs(changes);
    if (this._dialog?.kind === "categories") this._renderDialog();
    try {
      await this._store.call({ type: "taskdragon/set_prefs", prefs: changes });
    } catch (err) {
      this._fail(err);
      this._store.refresh();
    }
  }

  _toggleCollapsed(key) {
    const collapsed = new Set(this._prefs().collapsed);
    if (collapsed.has(key)) collapsed.delete(key);
    else collapsed.add(key);
    return this._savePrefs({ collapsed: [...collapsed].slice(-500) });
  }

  _onClick(event) {
    if (this._suppressClick) {
      this._suppressClick = false;
      event.preventDefault();
      return;
    }
    const path = event.composedPath();
    // Links (e.g. "Recipe" badges) open normally instead of triggering the row.
    if (path.some((el) => el.tagName === "A")) return;
    const target = path.find((el) => el instanceof HTMLElement && el.dataset && el.dataset.action);
    const maint = this._ui.maint;
    const maintMenu = maint.addMenu || maint.headMenu;
    if (!target) {
      if (this._ui.menu || this._ui.planMenu) {
        this._ui.menu = this._ui.planMenu = false;
        this._renderChrome();
      }
      if (maintMenu) {
        maint.addMenu = maint.headMenu = false;
        this._renderBody();
      }
      return;
    }
    const action = target.dataset.action;
    if (action === "dialog-backdrop" && path[0] !== target) return;
    if (action !== "menu" && action !== "plan-menu" && (this._ui.menu || this._ui.planMenu)) {
      this._ui.menu = this._ui.planMenu = false;
      this._renderChrome();
    }
    if (maintMenu && action !== "m-add-menu" && action !== "m-head-menu") {
      maint.addMenu = maint.headMenu = false;
      this._renderBody();
    }
    this._handleAction(action, target, event).catch((err) => console.debug("TaskDragon action failed", err));
  }

  async _handleAction(action, el, event) {
    const id = el.dataset.id;
    const ui = this._ui;
    switch (action) {
      case "noop":
        return;
      case "tab":
        ui.tab = id;
        ui.planMenu = false;
        ui.selected.clear();
        ui.renaming = null;
        if (this._idx.plans.get(id)?.archetype === "shopping_errands" && ui.showHistory) this._loadHistory(id);
        if (this._idx.plans.get(id)?.archetype === "wishlist_hoard") {
          this._hoardError = null;
          if (this._hData(id)) this._queueHoardLoad(id);
        }
        if (this._idx.plans.get(id)?.archetype === "home_maintenance") {
          Object.assign(ui.maint, { taskId: null, objectId: null, search: false, addMenu: false, headMenu: false, area: null });
          this._maintError = null;
          if (this._maintData(id)) this._queueMaintLoad(id);
        }
        return this._render();
      case "person-chip":
        if (this._currentTab() === "myday") {
          ui.people = ui.people.has(id) && ui.people.size === 1 ? new Set() : new Set([id]);
        } else if (ui.people.has(id)) ui.people.delete(id);
        else ui.people.add(id);
        return this._render();
      case "menu":
        ui.menu = !ui.menu;
        ui.planMenu = false;
        return this._renderChrome();
      case "refresh":
        return this._store.refresh();
      case "mealie-sync": {
        const status = await this._call({ type: "taskdragon/mealie_sync" });
        return this._showToast(status.ok ? "Mealie synced" : `Mealie: ${status.error || "sync failed"}`);
      }
      case "plan-menu":
        ui.planMenu = !ui.planMenu;
        ui.menu = false;
        return this._renderChrome();
      case "myday-all":
        ui.allMine = !ui.allMine;
        return this._renderBody();
      case "toggle-done":
        ui.showDone.has(id) ? ui.showDone.delete(id) : ui.showDone.add(id);
        return this._renderBody();
      case "collapse":
        return this._toggleCollapsed(id);
      case "expand":
        if (event.composedPath().some((n) => n.dataset && "stop" in n.dataset)) return;
        ui.expanded.has(id) ? ui.expanded.delete(id) : ui.expanded.add(id);
        return this._renderBody();
      case "toggle":
        return this._toggleTask(id);
      case "clear-one":
        return this._clearTask(id);
      case "search-toggle": {
        const open = !!(ui.searchOpen || ui.search);
        ui.searchOpen = !open;
        if (open && ui.search) {
          ui.search = "";
          this.shadowRoot.querySelector(".td-search").value = "";
          this._renderBody();
        }
        this._renderChrome();
        if (ui.searchOpen) setTimeout(() => this.shadowRoot.querySelector(".td-search")?.focus(), 30);
        return;
      }
      case "claim": {
        await this._call({ type: "taskdragon/claim_task", uid: id });
        return this._showToast("Claimed — it's yours");
      }
      case "open":
        event.stopPropagation();
        return this._openTask(id);
      case "add-task":
        return this._openTask(null, { plan_id: el.dataset.plan, time_of_day_bucket: el.dataset.bucket });
      case "snooze":
        return this._openDialog({ kind: "snooze", task: this._idx.tasks.get(id) });
      case "unsnooze":
        await this._call({ type: "taskdragon/unsnooze", uid: id });
        return this._showToast("Back on the list");
      case "delete-sub": {
        const res = await this._call({ type: "taskdragon/delete_tasks", uids: [id] });
        return this._showToast("Checklist item removed", this._undoWith(res.undo));
      }
      case "brain-send":
        return this._brainDump();
      case "brain-mic":
        return this._listen(el);

      /* Quick lists */
      case "quick-scope":
        ui.quickScope = id === "private" ? "private" : "shared";
        storage.set("taskdragon.quickScope", ui.quickScope);
        return this._renderBody();
      case "quick-add":
        return this._quickAdd(el.dataset.plan);
      case "section-add":
        return this._sectionAdd(el.dataset.plan);
      case "section-rename":
        ui.renaming = id;
        return this._renderBody();
      case "section-rename-cancel":
        ui.renaming = null;
        return this._renderBody();
      case "section-rename-save":
        return this._sectionRename(id);
      case "section-move":
        return this._sectionMove(id, Number(el.dataset.dir));
      case "section-delete": {
        const res = await this._call({ type: "taskdragon/delete_section", section_id: id });
        return this._showToast(res.moved ? `Section deleted · ${res.moved} task(s) moved to the inbox` : "Section deleted", this._undoWith(res.undo));
      }
      case "promote":
        return this._openDialog({ kind: "promote", task: this._idx.tasks.get(id) });
      case "promote-to":
        return this._promoteTo(id);
      case "promote-recurring":
        return this._promoteRecurring();

      /* Categories */
      case "categories":
        return this._openDialog({ kind: "categories" });
      case "tab-visibility": {
        const hidden = new Set(this._prefs().hidden_tabs);
        if (hidden.has(id)) hidden.delete(id);
        else {
          if (this._shownTabs().length <= 1) return this._showToast("Keep at least one tab visible");
          hidden.add(id);
          if (this._currentTab() === id) ui.tab = null;
        }
        if (this._dialog?.kind === "plan") this._closeDialog();
        await this._savePrefs({ hidden_tabs: [...hidden] });
        return hidden.has(id) ? this._showToast("Tab hidden · bring it back from ⚙ Manage categories") : null;
      }
      case "tab-move": {
        const keys = this._allTabs().map((t) => t.key);
        const from = keys.indexOf(id);
        const to = from + Number(el.dataset.dir);
        if (from < 0 || to < 0 || to >= keys.length) return;
        [keys[from], keys[to]] = [keys[to], keys[from]];
        return this._savePrefs({ tab_order: keys });
      }
      case "pick-icon":
        return this._setIcon(id);

      /* Shopping */
      case "shop-add":
        return this._shopAdd(el.dataset.plan);
      case "history-toggle":
        ui.showHistory = !ui.showHistory;
        if (ui.showHistory) this._loadHistory(el.dataset.plan);
        return this._renderBody();
      case "history-add": {
        const res = await this._call({ type: "taskdragon/add_shopping_item", plan_id: el.dataset.plan, text: el.dataset.name });
        this._loadHistory(el.dataset.plan);
        return this._showToast(res.merged ? `${res.task.summary} is already on the list` : `Added ${res.task.summary}`);
      }
      case "clear-completed": {
        const res = await this._call({ type: "taskdragon/clear_completed", plan_id: el.dataset.plan });
        return this._showToast(`Cleared ${res.count}`, this._undoWith(res.undo));
      }

      /* Projects */
      case "kanban-mode":
        ui.kanbanMode = id;
        return this._renderBody();
      case "bom-add":
        return this._bomAdd(el.dataset.plan);
      case "bom-toggle":
        return this._call({ type: "taskdragon/save_bom_item", item: { id, acquired: el.checked } });
      case "bom-delete":
        return this._call({ type: "taskdragon/delete_bom_item", item_id: id });
      case "bom-push": {
        const res = await this._call({ type: "taskdragon/push_bom", plan_id: el.dataset.plan });
        return this._showToast(res.pushed.length ? `Pushed ${res.pushed.length} item(s) to the hardware list` : "Everything is already on the list");
      }

      /* Trips */
      case "trip-new":
        return this._openDialog({ kind: "trip", trip: { plan_id: el.dataset.plan, name: "", start_date: "", end_date: "" } });
      case "trip-edit":
        return this._openDialog({ kind: "trip", trip: { ...this._findTrip(id) } });
      case "trip-save":
        return this._tripSave();
      case "trip-reset": {
        const trip = this._findTrip(id);
        if (!confirm(`Uncheck everything on “${trip?.name || "this trip"}”?`)) return;
        const res = await this._call({ type: "taskdragon/reset_trip", trip_id: id });
        return this._showToast(`Unchecked ${res.reset} item(s)`);
      }
      case "trip-archive": {
        const archived = !!el.dataset.archived;
        await this._call({ type: "taskdragon/save_trip", trip: { id, status: archived ? "active" : "archived" } });
        return this._showToast(archived ? "Trip restored" : "Trip archived");
      }
      case "trip-delete": {
        const trip = this._findTrip(id);
        if (!confirm(`Delete “${trip?.name || "this trip"}” and its packing list?`)) return;
        const res = await this._call({ type: "taskdragon/delete_trip", trip_id: id });
        return this._showToast("Trip deleted", this._undoWith(res.undo));
      }
      case "repeat-toggle":
        return this._toggleRepeat(id);
      case "pack-add":
        return this._packAdd(el.dataset.plan, el.dataset.trip || "");
      case "pack-group-add": {
        const trip = el.dataset.trip || "";
        const input = [...this.shadowRoot.querySelectorAll("[data-trip-input]")].find((node) => node.dataset.tripInput === trip);
        if (input) {
          input.value = `${el.dataset.group}: `;
          input.focus();
        }
        return;
      }

      /* Pantry */
      case "pantry-add":
        return this._pantryAdd(el.dataset.plan);
      case "pantry-state":
        return this._pantryState(id, el.dataset.state);
      case "pantry-edit":
        return this._openDialog({ kind: "pantry", item: { ...(this._board.pantry || []).find((i) => i.id === id) } });
      case "pantry-save":
        return this._pantrySave();
      case "pantry-delete": {
        const res = await this._call({ type: "taskdragon/delete_pantry_item", item_id: this._dialog.item.id });
        this._closeDialog();
        return this._showToast("Pantry item deleted", this._undoWith(res.undo));
      }
      case "pantry-fetch": {
        const item = await this._call({ type: "taskdragon/pantry_fetch_recipe", item_id: this._dialog.item.id });
        this._dialog.item = item;
        this._renderDialog();
        return this._showToast(`Loaded ${item.ingredients.length} ingredients`);
      }
      case "pantry-low-choice": {
        const d = this._dialog;
        this._closeDialog();
        const res = await this._call({ type: "taskdragon/trigger_pantry_low", item_id: d.item.id, state: d.state, action: el.dataset.choice });
        return this._reportPantry(res);
      }

      /* Plans */
      case "plan-new":
        return this._openDialog({ kind: "plan", plan: { archetype: "quick_list", settings: {}, is_private: false } });
      case "plan-edit": {
        const plan = this._idx.plans.get(id);
        if (!plan) return;
        const dialog = { kind: "plan", plan: JSON.parse(JSON.stringify(plan)), mealieLists: [] };
        this._openDialog(dialog);
        if (plan.archetype === "shopping_errands" && this._board.mealie?.enabled && this._isAdmin()) {
          try {
            dialog.mealieLists = await this._store.call({ type: "taskdragon/mealie_lists" });
            if (this._dialog === dialog) this._renderDialog();
          } catch (err) {
            this._fail(err);
          }
        }
        return;
      }
      case "plan-save":
        return this._planSave();
      case "plan-archive": {
        await this._call({ type: "taskdragon/save_plan", plan: { id: this._dialog.plan.id, archived: true } });
        this._closeDialog();
        ui.tab = null;
        return this._showToast("Category archived · restore it from ⚙ Manage categories");
      }
      case "plan-unarchive":
        await this._call({ type: "taskdragon/save_plan", plan: { id, archived: false } });
        return this._showToast("Category restored");
      case "plan-delete": {
        const plan = this._dialog.plan;
        if (!confirm(`Delete “${plan.name}” and everything in it? This cannot be undone.`)) return;
        await this._call({ type: plan.is_private ? "taskdragon/delete_private_plan" : "taskdragon/delete_plan", plan_id: plan.id });
        this._closeDialog();
        ui.tab = null;
        return this._showToast("Category deleted");
      }

      /* Bulk & dialogs */
      case "bulk-mode":
        ui.bulk = !ui.bulk;
        ui.selected.clear();
        return this._render();
      case "bulk-select":
        el.checked ? ui.selected.add(id) : ui.selected.delete(id);
        return this._renderBulkBar();
      case "bulk-do":
        return this._bulk(id);
      case "dialog-backdrop":
      case "dialog-close":
        return this._closeDialog();
      case "dialog-save":
        return this._saveTaskDialog();
      case "dialog-delete": {
        const uid = this._dialog.task.uid;
        this._closeDialog();
        const res = await this._call({ type: "taskdragon/delete_tasks", uids: [uid] });
        return this._showToast("Task deleted", this._undoWith(res.undo));
      }
      case "snooze-time":
        return this._snooze({ type: "taskdragon/snooze", until: el.dataset.until });
      case "snooze-custom": {
        const value = this.shadowRoot.querySelector(".snooze-custom")?.value;
        if (!value) return;
        return this._snooze({ type: "taskdragon/snooze", until: new Date(value).toISOString() });
      }
      case "snooze-ctx":
        return this._snooze({ type: "taskdragon/snooze_context", rule_type: el.dataset.type, config: {} });
      case "snooze-entity": {
        const q = (sel) => this.shadowRoot.querySelector(sel)?.value?.trim();
        const config = { entity_id: q(".snooze-entity") };
        if (q(".snooze-state")) config.state = q(".snooze-state");
        if (q(".snooze-above")) config.above = Number(q(".snooze-above"));
        if (q(".snooze-below")) config.below = Number(q(".snooze-below"));
        return this._snooze({ type: "taskdragon/snooze_context", rule_type: "entity_state", config });
      }
      case "undo": {
        const undo = this._toast?.undo;
        setHTML(this.shadowRoot.querySelector(".td-toast-host"), html``);
        this._toast = null;
        if (undo) await undo();
        return;
      }
      case "toast-act": {
        const act = this._toast?.actions?.[Number(el.dataset.index)];
        clearTimeout(this._toastTimer);
        setHTML(this.shadowRoot.querySelector(".td-toast-host"), html``);
        this._toast = null;
        if (act) await act.run();
        return;
      }
      default:
        if (action.startsWith("m-")) return this._maintAction(action, el, event);
        if (action.startsWith("r-")) return this._recipeAction(action, el, event);
        if (action.startsWith("s-")) return this._scanAction(action, el, event);
        if (action.startsWith("c-")) return this._cookAction(action, el, event);
        if (action.startsWith("b-")) return this._settingsAction(action, el, event);
        if (action.startsWith("h-")) return this._hoardAction(action, el, event);
        return;
    }
  }

  _onKeyDown(event) {
    if (event.key === "Escape" && this._scan) {
      this._scanStop();
      return;
    }
    const focused = event.composedPath()[0];
    if ((event.key === "Enter" || event.key === " ") && focused?.classList?.contains("cstep")) {
      event.preventDefault();
      this._cookAction("c-step", focused);
      return;
    }
    if (event.key === "Escape" && focused?.classList?.contains("td-search") && !this._dialog) {
      this._ui.search = "";
      this._ui.searchOpen = false;
      focused.value = "";
      this._renderChrome();
      this._renderBody();
      return;
    }
    if (event.key === "Escape") {
      if (this._ui.planMenu || this._ui.menu) {
        this._ui.planMenu = this._ui.menu = false;
        this._renderChrome();
        return;
      }
      if (this._dialog) {
        this._closeDialog();
        return;
      }
      if (this._ui.renaming) {
        this._ui.renaming = null;
        this._renderBody();
        return;
      }
      const maint = this._ui.maint;
      if (maint.addMenu || maint.headMenu) {
        maint.addMenu = maint.headMenu = false;
        this._renderBody();
        return;
      }
      if (maint.search) {
        maint.search = false;
        maint.query = "";
        this._renderBody();
        return;
      }
    }
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    const el = event.composedPath()[0];
    if (!(el instanceof HTMLInputElement)) return;
    const data = el.dataset;
    const handlers = [
      [el.classList.contains("brain-input"), () => this._brainDump()],
      [data.subtaskFor, () => this._addSubtask(data.subtaskFor, el)],
      [data.shopInput, () => this._shopAdd(data.shopInput)],
      [data.bomInput || data.bomQty, () => this._bomAdd(data.bomInput || data.bomQty)],
      [data.pantryInput, () => this._pantryAdd(data.pantryInput)],
      [data.seasoningInput !== undefined, () => this._seasoningAdd(el)],
      [data.scanManual !== undefined, () => this._scanManual()],
      [data.hoardInput || data.hurl || data.hrecord || data.hsel, () => this._hoardKey(el)],
      [data.scanQty !== undefined, () => this._scanAction("s-restock-custom", el)],
      [data.quickInput, () => this._quickAdd(data.quickInput)],
      [data.sectionInput !== undefined && data.plan, () => this._sectionTaskAdd(el)],
      [data.newSection, () => this._sectionAdd(data.newSection)],
      [data.renameSection, () => this._sectionRename(data.renameSection)],
      [data.tripInput !== undefined && data.plan, () => this._packAdd(data.plan, data.tripInput)],
    ];
    const match = handlers.find(([when]) => when);
    if (!match) return;
    event.preventDefault();
    match[1]();
  }

  _onInput(event) {
    const el = event.composedPath()[0];
    if (this._extrasInput(el)) return;
    if (this._hoardInput(el)) return;
    if (el.classList?.contains("td-search")) {
      this._ui.search = el.value;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this._renderBody(), 80);
    } else if (el.dataset?.iconInput !== undefined) {
      this._setIcon(el.value);
    } else if (el.dataset?.rsearch !== undefined) {
      this._ui.recipes.query = el.value;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this._renderBody(), 120);
    } else if (el.dataset?.msearch !== undefined) {
      this._ui.maint.query = el.value;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this._renderBody(), 120);
    }
  }

  _onChange(event) {
    const el = event.composedPath()[0];
    if (this._maintChange(el)) return;
    if (this._recipeChange(el)) return;
    if (this._extrasChange(el)) return;
    if (this._hoardChange(el)) return;
    if (el.dataset?.bulk && el.value) {
      const value = el.value;
      el.value = "";
      this._bulk(el.dataset.bulk, value);
    } else if (el.dataset?.quickSection) {
      this._ui.quickTarget = { ...(this._ui.quickTarget || {}), [el.dataset.quickSection]: el.value };
    } else if (el.dataset?.remindTarget !== undefined) {
      // The reminder time only applies once a phone is picked.
      const time = this.shadowRoot.querySelector('.task-form [name="remind_time"]');
      if (time) time.disabled = !el.value;
    } else if (el.name === "rec_kind") {
      const form = this.shadowRoot.querySelector(".task-form");
      for (const node of form.querySelectorAll(".rec")) node.hidden = !node.classList.contains(`rec-${el.value}`);
    } else if (el.name === "plan_id" && this._dialog?.kind === "task") {
      // Re-render with the new plan's fields (shopping vs. maintenance) while keeping typed values.
      const draft = this._readTaskForm();
      this._dialog.task = { ...this._dialog.task, ...draft.task, plan_id: el.value, section_id: null, trip_id: null };
      this._renderDialog();
    }
  }

  async _toggleTask(uid) {
    const task = this._idx.tasks.get(uid);
    if (!task || task.status === "blocked") return;
    const completed = task.status !== "completed";
    const previous = { status: task.status, completed_at: task.completed_at };
    // Optimistic: the row is crossed out before the server answers.
    this._store.patchTask(uid, { status: completed ? "completed" : "needs_action", completed_at: completed ? new Date().toISOString() : null });
    try {
      const res = await this._store.call({ type: "taskdragon/set_completed", uid, completed });
      if (completed && this._planOf(task).archetype !== "packing_trips") {
        const extra = res.unblocked?.length ? ` · unblocked ${res.unblocked.length}` : res.next_due ? ` · next ${res.next_due === addDays(this._today(), 1) ? "tomorrow" : monthDay(res.next_due)}` : "";
        this._showToast(`Done: ${task.summary}${extra}`, () => this._call({ type: "taskdragon/set_completed", uid, completed: false }));
      }
    } catch (err) {
      this._store.patchTask(uid, previous);
      this._fail(err);
    }
  }

  /** Take a finished one-off task off the list (undo brings it back). */
  async _clearTask(uid, label = "Cleared") {
    const task = this._idx.tasks.get(uid);
    if (!task) return;
    const res = await this._call({ type: "taskdragon/delete_tasks", uids: [uid] });
    this._showToast(`${label}: ${task.summary}`, this._undoWith(res.undo));
  }

  async _toggleRepeat(uid) {
    const task = this._idx.tasks.get(uid);
    if (!task) return;
    const repeatable = !task.is_repeatable;
    this._store.patchTask(uid, { is_repeatable: repeatable });
    try {
      await this._store.call({ type: "taskdragon/set_repeatable", uid, repeatable });
      this._showToast(repeatable ? `“${task.summary}” will be added to every new trip` : `“${task.summary}” is a one-off now`);
    } catch (err) {
      this._store.patchTask(uid, { is_repeatable: !repeatable });
      this._fail(err);
    }
  }

  _findTrip(id) {
    return (this._board.trips || []).find((t) => t.id === id);
  }

  /** A reminder's tap opens TaskDragon at ?task=<uid>: show that task. */
  _tDeepLink() {
    if (this._tLinked || !this._board || !this.hasAttribute("panel")) return;
    this._tLinked = true;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("task");
    if (!uid) return;
    params.delete("task");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    const task = this._idx.tasks.get(uid);
    if (!task) return this._showToast("That task isn't on the list anymore");
    const plan = this._planOf(task);
    if (plan?.id && this._idx.plans.has(plan.id) && plan.archetype !== "quick_list") this._ui.tab = plan.id;
    this._render();
    this._openTask(uid);
  }

  async _openTask(uid, defaults = {}) {
    let task;
    if (uid) task = JSON.parse(JSON.stringify(this._idx.tasks.get(uid)));
    else {
      const tab = this._currentTab();
      const tabPlan = tab === "quick" ? this._quickPlanId() : this._idx.plans.has(tab) ? tab : null;
      const fallbackPlan =
        defaults.plan_id ||
        tabPlan ||
        this._activePlans().find((p) => p.settings?.role === "chores")?.id ||
        this._activePlans().find((p) => ACTIONABLE.has(p.archetype))?.id;
      const me = this._me();
      const plan = this._idx.plans.get(fallbackPlan);
      task = {
        plan_id: fallbackPlan,
        summary: "",
        status: "needs_action",
        priority: "none",
        time_of_day_bucket: defaults.time_of_day_bucket || "anytime",
        context_tags: [],
        assigned_to: tab === "myday" && me ? [me] : [],
        recurrence_mode: "none",
        section_id: defaults.section_id || null,
        due_date: plan?.archetype === "daily_chores" || tab === "myday" || tab === "family" ? this._today() : null,
      };
    }
    const dialog = { kind: "task", task, history: null, promoting: !!defaults.promoting };
    if (defaults.promoting) Object.assign(task, defaults.overrides || {});
    this._openDialog(dialog);
    if (uid) {
      try {
        dialog.history = await this._store.call({ type: "taskdragon/task_history", uid });
        const block = this.shadowRoot.querySelector(".history-block");
        if (this._dialog === dialog && block) setHTML(block, this._historyHtml(dialog.history));
      } catch (_err) {
        /* history is optional */
      }
    }
  }

  _readTaskForm() {
    const form = this.shadowRoot.querySelector(".task-form");
    if (!form) return { task: {} };
    const val = (name) => form.querySelector(`[name="${name}"]`)?.value ?? null;
    const has = (name) => !!form.querySelector(`[name="${name}"]`);
    const checked = (name) => [...form.querySelectorAll(`[name="${name}"]:checked`)].map((n) => n.value);
    const t = {
      summary: (val("summary") || "").trim(),
      plan_id: val("plan_id"),
      status: val("status"),
      priority: val("priority"),
      time_of_day_bucket: val("time_of_day_bucket"),
      assigned_to: checked("assignee"),
      description: val("description") || null,
      shift_aware: !!form.querySelector('[name="shift_aware"]')?.checked,
    };
    const dueAt = val("due_datetime");
    if (dueAt) {
      t.due_datetime = new Date(dueAt).toISOString();
    } else {
      t.due_datetime = null;
      t.due_date = val("due_date") || null;
    }
    if (has("quantity")) t.quantity = val("quantity") || null;
    if (has("category")) t.category = val("category") || null;
    if (has("section_id")) t.section_id = val("section_id") || null;
    if (has("trip_id")) t.trip_id = val("trip_id") || null;
    if (has("remind_target")) {
      t.remind_target = val("remind_target") || null;
      t.remind_time = t.remind_target ? val("remind_time") || null : null;
    }
    if (has("is_repeatable")) t.is_repeatable = !!form.querySelector('[name="is_repeatable"]').checked;
    if (has("sensor_entity_id")) {
      t.sensor_entity_id = val("sensor_entity_id") || null;
      t.sensor_mode = val("sensor_mode");
      t.sensor_threshold = val("sensor_threshold") ? Number(val("sensor_threshold")) : null;
    }
    if (has("blocked_by") || has("hide_when_blocked")) {
      t.blocked_by = checked("blocked_by");
      t.hide_when_blocked = !!form.querySelector('[name="hide_when_blocked"]')?.checked;
    }
    const kind = val("rec_kind");
    if (kind === "none") Object.assign(t, { recurrence_mode: "none", recurrence_rule: null, recurrence_interval_days: null });
    else if (kind === "daily") Object.assign(t, { recurrence_mode: "calendar", recurrence_rule: "FREQ=DAILY" });
    else if (kind === "weekly") {
      const days = checked("rec_day");
      Object.assign(t, { recurrence_mode: "calendar", recurrence_rule: days.length ? `FREQ=WEEKLY;BYDAY=${days.join(",")}` : "FREQ=WEEKLY" });
    } else if (kind === "monthly") Object.assign(t, { recurrence_mode: "calendar", recurrence_rule: `FREQ=MONTHLY;BYMONTHDAY=${val("rec_monthday") || 1}` });
    else if (kind === "rolling") Object.assign(t, { recurrence_mode: "rolling", recurrence_interval_days: Number(val("rec_interval") || 30), recurrence_rule: null });
    else if (kind === "custom") Object.assign(t, { recurrence_mode: "calendar", recurrence_rule: val("rec_rule") || null });
    const subtasks = (val("subtasks") || "").split("\n").map((s) => s.trim()).filter(Boolean);
    return { task: t, subtasks };
  }

  async _saveTaskDialog() {
    const d = this._dialog;
    const { task, subtasks } = this._readTaskForm();
    if (!task.summary) {
      this._showToast("A task needs a title");
      return;
    }
    if (task.status === "snoozed") delete task.status;
    const payload = { ...task };
    if (d.task.uid) payload.uid = d.task.uid;
    else payload.dedupe = true;
    try {
      const saved = await this._store.call({ type: "taskdragon/save_task", task: payload });
      for (const summary of subtasks) {
        await this._store.call({ type: "taskdragon/save_task", task: { parent_uid: saved.uid, summary } });
      }
      this._closeDialog();
      const planName = this._idx.plans.get(saved.plan_id)?.name || "";
      this._showToast(d.promoting ? `Moved to ${planName} · repeats ${saved.recurrence_label || ""}`.trim() : d.task.uid ? "Saved" : `Added ${saved.summary}`);
    } catch (err) {
      this._fail(err);
    }
  }

  async _addSubtask(parentUid, input) {
    const summary = input.value.trim();
    if (!summary) return;
    input.value = "";
    this._ui.expanded.add(parentUid);
    await this._call({ type: "taskdragon/save_task", task: { parent_uid: parentUid, summary } });
  }

  async _snooze(message) {
    const task = this._dialog.task;
    this._closeDialog();
    await this._call({ ...message, uid: task.uid });
    this._showToast(`Snoozed: ${task.summary}`, () => this._call({ type: "taskdragon/unsnooze", uid: task.uid }));
  }

  /* Quick lists */

  async _quickAdd(planId) {
    const input = [...this.shadowRoot.querySelectorAll("[data-quick-input]")].find((n) => n.dataset.quickInput === planId);
    const select = [...this.shadowRoot.querySelectorAll("[data-quick-section]")].find((n) => n.dataset.quickSection === planId);
    let summary = input?.value.trim();
    if (!summary) return;
    let sectionId = select?.value || null;
    // "Calls: dentist" goes to the section named Calls (or Calls to Make).
    const prefix = summary.match(/^([^:]{1,60}):\s*(.+)$/);
    if (prefix) {
      const wanted = prefix[1].trim().toLowerCase();
      const sections = this._idx.sections.get(planId) || [];
      const section = sections.find((s) => s.name.toLowerCase() === wanted) || sections.find((s) => s.name.toLowerCase().startsWith(wanted));
      if (section) {
        sectionId = section.id;
        summary = prefix[2].trim();
      }
    }
    input.value = "";
    const task = await this._call({ type: "taskdragon/save_task", task: { plan_id: planId, summary, section_id: sectionId } });
    const where = this._idx.sections.get(planId)?.find((s) => s.id === sectionId)?.name || "Inbox";
    this._showToast(`Added to ${where}`, () => this._call({ type: "taskdragon/delete_tasks", uids: [task.uid] }));
  }

  async _sectionTaskAdd(input) {
    const summary = input.value.trim();
    if (!summary) return;
    input.value = "";
    await this._call({ type: "taskdragon/save_task", task: { plan_id: input.dataset.plan, summary, section_id: input.dataset.sectionInput || null } });
  }

  async _sectionAdd(planId) {
    const input = [...this.shadowRoot.querySelectorAll("[data-new-section]")].find((n) => n.dataset.newSection === planId);
    const name = input?.value.trim();
    if (!name) return;
    input.value = "";
    await this._call({ type: "taskdragon/save_section", section: { plan_id: planId, name } });
    this._showToast(`Section “${name}” added`);
  }

  async _sectionRename(sectionId) {
    const input = [...this.shadowRoot.querySelectorAll("[data-rename-section]")].find((n) => n.dataset.renameSection === sectionId);
    const name = input?.value.trim();
    this._ui.renaming = null;
    if (!name) return this._renderBody();
    await this._call({ type: "taskdragon/save_section", section: { id: sectionId, name } });
    return this._renderBody();
  }

  async _sectionMove(sectionId, dir) {
    const section = (this._board.sections || []).find((s) => s.id === sectionId);
    if (!section) return;
    const ids = (this._idx.sections.get(section.plan_id) || []).map((s) => s.id);
    const from = ids.indexOf(sectionId);
    const to = from + dir;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await this._call({ type: "taskdragon/reorder_sections", plan_id: section.plan_id, section_ids: ids });
  }

  async _promoteTo(planId) {
    const task = this._dialog?.task;
    if (!task) return;
    const from = { plan_id: task.plan_id, section_id: task.section_id || null };
    this._closeDialog();
    await this._call({ type: "taskdragon/transfer_task", uid: task.uid, plan_id: planId });
    const name = this._idx.plans.get(planId)?.name || "the plan";
    this._showToast(`Moved “${task.summary}” to ${name}`, () =>
      this._call({ type: "taskdragon/move_task", uid: task.uid, plan_id: from.plan_id, section_id: from.section_id }),
    );
  }

  _promoteRecurring() {
    const task = this._dialog?.task;
    if (!task) return;
    const chores = this._activePlans().find((p) => p.settings?.role === "chores") || this._activePlans().find((p) => p.archetype === "daily_chores");
    const weekday = WEEKDAYS[(new Date().getDay() + 6) % 7][0];
    return this._openTask(task.uid, {
      promoting: true,
      overrides: {
        plan_id: chores?.id || task.plan_id,
        recurrence_mode: "calendar",
        recurrence_rule: `FREQ=WEEKLY;BYDAY=${weekday}`,
        section_id: null,
      },
    });
  }

  /* Trips */

  async _tripSave() {
    const form = this.shadowRoot.querySelector(".trip-form");
    const d = this._dialog;
    const val = (n) => form.querySelector(`[name="${n}"]`)?.value ?? "";
    const trip = { name: val("name").trim(), start_date: val("start_date") || null, end_date: val("end_date") || null };
    if (!trip.name) return this._showToast("A trip needs a name");
    if (d.trip.id) {
      trip.id = d.trip.id;
      trip.status = form.querySelector('[name="archived"]')?.checked ? "archived" : "active";
    } else {
      trip.plan_id = d.trip.plan_id;
    }
    const res = await this._call({ type: "taskdragon/save_trip", trip });
    this._closeDialog();
    if (!d.trip.id) {
      // Make sure the new trip is open.
      const key = `trip:${res.trip.id}`;
      if (this._isCollapsed(key)) this._toggleCollapsed(key);
      this._showToast(res.added ? `Trip created with ${res.added} repeatable item${res.added === 1 ? "" : "s"}` : "Trip created");
    } else {
      this._showToast("Trip saved");
    }
  }

  async _packAdd(planId, tripId) {
    const input = [...this.shadowRoot.querySelectorAll("[data-trip-input]")].find((n) => n.dataset.tripInput === tripId && n.dataset.plan === planId);
    let summary = input?.value.trim();
    if (!summary) return;
    let category = null;
    const prefix = summary.match(/^([^:]{1,40}):\s*(.+)$/);
    if (prefix) {
      category = prefix[1].trim();
      summary = prefix[2].trim();
    }
    input.value = category ? `${category}: ` : "";
    await this._call({ type: "taskdragon/save_task", task: { plan_id: planId, trip_id: tripId || null, summary, category } });
  }

  /* Brain dump & voice */

  async _brainDump() {
    const input = this.shadowRoot.querySelector(".brain-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.disabled = true;
    try {
      const res = await this._store.call({ type: "taskdragon/brain_dump", text });
      const ok = res.results.filter((r) => r.ok);
      const failed = res.results.filter((r) => !r.ok);
      if (!ok.length && !failed.length) {
        input.value = text;
        this._showToast("Couldn't find anything to add in that.");
        return;
      }
      const planName = (id) => this._idx.plans.get(id)?.name || "";
      const summary = ok.map((r) => `${r.summary}${planName(r.plan_id) ? ` → ${planName(r.plan_id)}` : ""}`).join(", ");
      const created = ok.filter((r) => !r.merged).map((r) => r.uid);
      this._showToast(
        `${res.engine === "llm" ? "🤖 " : ""}Added ${summary}${failed.length ? ` (${failed.length} failed)` : ""}`,
        created.length ? () => this._call({ type: "taskdragon/delete_tasks", uids: created }) : null,
      );
    } catch (err) {
      input.value = text;
      this._fail(err);
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  _listen(button) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      this._showToast("Voice input isn't available here — use your keyboard's microphone, or Assist.");
      return;
    }
    if (this._recognition) {
      this._recognition.stop();
      return;
    }
    const input = this.shadowRoot.querySelector(".brain-input");
    const recognition = new Recognition();
    recognition.lang = this._hass?.locale?.language || this._hass?.language || navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      input.value = (finalText + interim).trim();
    };
    recognition.onerror = (e) => this._showToast(`Voice input error: ${e.error}`);
    recognition.onend = () => {
      button.classList.remove("on");
      this._recognition = null;
      if (finalText.trim()) {
        input.value = finalText.trim();
        this._brainDump();
      }
    };
    this._recognition = recognition;
    button.classList.add("on");
    recognition.start();
  }

  /* Shopping, BOM, pantry */

  async _shopAdd(planId) {
    const input = this.shadowRoot.querySelector(`[data-shop-input="${CSS.escape(planId)}"]`);
    const text = input?.value.trim();
    if (!text) return;
    input.value = "";
    const res = await this._call({ type: "taskdragon/add_shopping_item", plan_id: planId, text });
    if (this._ui.showHistory) this._loadHistory(planId);
    this._showToast(
      res.merged ? `Merged into ${res.task.summary}${res.task.quantity ? ` (${res.task.quantity})` : ""}` : `Added ${res.task.summary} · ${res.task.category}`,
      res.merged ? null : () => this._call({ type: "taskdragon/delete_tasks", uids: [res.task.uid] }),
    );
  }

  async _loadHistory(planId) {
    try {
      this._history[planId] = await this._store.call({ type: "taskdragon/item_history", plan_id: planId });
    } catch (_err) {
      this._history[planId] = [];
    }
    if (this._currentTab() === planId) this._renderBody();
  }

  async _bomAdd(planId) {
    const nameEl = this.shadowRoot.querySelector(`[data-bom-input="${CSS.escape(planId)}"]`);
    const qtyEl = this.shadowRoot.querySelector(`[data-bom-qty="${CSS.escape(planId)}"]`);
    const name = nameEl?.value.trim();
    if (!name) return;
    const quantity = qtyEl?.value.trim() || null;
    nameEl.value = "";
    if (qtyEl) qtyEl.value = "";
    this._ui.showDone.add(`bom-${planId}`);
    await this._call({ type: "taskdragon/save_bom_item", item: { plan_id: planId, name, quantity } });
  }

  async _pantryAdd(planId) {
    const input = this.shadowRoot.querySelector(`[data-pantry-input="${CSS.escape(planId)}"]`);
    const name = input?.value.trim();
    if (!name) return;
    input.value = "";
    await this._call({ type: "taskdragon/save_pantry_item", item: { plan_id: planId, name } });
  }

  async _pantryState(itemId, state) {
    const item = (this._board.pantry || []).find((i) => i.id === itemId);
    if (!item || item.stock_state === state) return;
    const res = await this._call({ type: "taskdragon/trigger_pantry_low", item_id: itemId, state });
    if (res.action_needed) {
      this._openDialog({ kind: "pantry-low", item: res.item, state });
      return;
    }
    this._reportPantry(res);
  }

  _reportPantry(res) {
    if (!res.created?.length) {
      if (res.item.stock_state === "in_stock") this._showToast(`${res.item.name} restocked`);
      return;
    }
    const names = res.created.map((c) => c.summary).join(", ");
    const created = res.created.filter((c) => !c.merged).map((c) => c.uid);
    this._showToast(
      res.action === "batch_task" ? `Added chore: ${names}` : `Added to shopping list: ${names}`,
      created.length ? () => this._call({ type: "taskdragon/delete_tasks", uids: created }) : null,
    );
  }

  async _pantrySave() {
    const form = this.shadowRoot.querySelector(".pantry-form");
    const val = (n) => form.querySelector(`[name="${n}"]`)?.value ?? "";
    const item = {
      name: val("name").trim(),
      category: val("category").trim() || null,
      quantity: val("quantity").trim() || null,
      is_batch: !!form.querySelector('[name="is_batch"]').checked,
      low_action: val("low_action"),
      mealie_recipe_slug: val("mealie_recipe_slug").trim() || null,
      ingredients: val("ingredients"),
      notes: val("notes").trim() || null,
    };
    if (!item.name) return this._showToast("A pantry item needs a name");
    if (this._dialog.item.id) item.id = this._dialog.item.id;
    else item.plan_id = this._currentTab();
    await this._call({ type: "taskdragon/save_pantry_item", item });
    this._closeDialog();
  }

  async _planSave() {
    const form = this.shadowRoot.querySelector(".plan-form");
    const val = (n) => form.querySelector(`[name="${n}"]`)?.value ?? null;
    const d = this._dialog;
    const plan = { name: (val("name") || "").trim(), icon: (val("icon") || "").trim() || null };
    if (!plan.name) return this._showToast("A category needs a name");
    if (plan.icon && !/^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plan.icon)) return this._showToast("Icons look like mdi:broom");
    const visibility = form.querySelector('[name="visibility"]:checked');
    if (visibility) plan.is_private = visibility.value === "private";
    if (form.querySelector('[name="share"]')) {
      plan.shared_with = [...form.querySelectorAll('[name="share"]:checked')].map((n) => n.value);
    }
    const settings = {};
    for (const key of ["role", "default_category", "mealie_list_id", "shopping_plan_id", "chore_plan_id"]) {
      if (form.querySelector(`[name="${key}"]`)) settings[key] = val(key) || null;
    }
    if (Object.keys(settings).length) plan.settings = settings;
    if (d.plan.id) plan.id = d.plan.id;
    else plan.archetype = form.querySelector('[name="archetype"]:checked')?.value || "quick_list";
    const saved = await this._call({ type: "taskdragon/save_plan", plan });
    this._closeDialog();
    const hidden = this._prefs().hidden_tabs;
    if (!d.plan.id && hidden.includes(saved.id)) await this._savePrefs({ hidden_tabs: hidden.filter((k) => k !== saved.id) });
    this._ui.tab = this._idx?.quickIds.has(saved.id) ? "quick" : saved.id;
    this._showToast(d.plan.id ? "Category saved" : `Created ${saved.name}${saved.is_private ? " (private)" : ""}`);
  }

  async _bulk(action, value = null) {
    const uids = [...this._ui.selected];
    if (!uids.length) return;
    if (action === "delete" && !confirm(`Delete ${uids.length} task(s)?`)) return;
    const res = await this._call({ type: "taskdragon/bulk_action", uids, action, value });
    this._ui.selected.clear();
    this._renderBulkBar();
    if (action === "delete") {
      this._showToast(`Deleted ${res.count}`, this._undoWith(res.undo));
    } else if (action === "complete") {
      this._showToast(`Completed ${res.count}`, () => this._call({ type: "taskdragon/bulk_action", uids, action: "uncomplete" }));
    } else {
      this._showToast(`Updated ${res.count}`);
    }
  }

  /* ---------------- Drag and drop (pointer events: mouse + touch) ---------------- */

  _onPointerDown(event) {
    if (event.button !== 0) return;
    const path = event.composedPath();
    const handle = path.find((el) => el.dataset && (el.dataset.drag || el.dataset.dragTile));
    if (!handle) {
      this._swipeStart(event, path);
      return;
    }
    const uid = handle.dataset.drag || handle.dataset.dragTile;
    const row = path.find((el) => el.classList?.contains("task-row"));
    if (!row) return;
    this._drag = { uid, row, startX: event.clientX, startY: event.clientY, active: false, tile: !!handle.dataset.dragTile, target: null };
    if (!this._drag.tile) event.preventDefault();
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp, { once: true });
    window.addEventListener("pointercancel", this._onPointerUp, { once: true });
  }

  _onPointerMove(event) {
    const drag = this._drag;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      // Tiles are tap targets: only start dragging after a deliberate move.
      if (Math.hypot(dx, dy) < (drag.tile ? 14 : 5)) return;
      drag.active = true;
      const rect = drag.row.getBoundingClientRect();
      drag.offsetX = drag.startX - rect.left;
      drag.offsetY = drag.startY - rect.top;
      drag.ghost = drag.row.cloneNode(true);
      drag.ghost.classList.add("ghost-drag");
      drag.ghost.style.width = `${rect.width}px`;
      this.shadowRoot.appendChild(drag.ghost);
      drag.row.classList.add("dragging");
    }
    event.preventDefault();
    drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
    drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;
    this._clearDropMarks();
    const under = this.shadowRoot.elementFromPoint(event.clientX, event.clientY);
    if (!under) return;
    const row = under.closest(".task-row");
    const zone = under.closest("[data-drop]");
    drag.target = null;
    if (row && row !== drag.row && row.dataset.uid) {
      const rect = row.getBoundingClientRect();
      const before = row.closest(".aisle-grid") ? event.clientX < rect.left + rect.width / 2 : event.clientY < rect.top + rect.height / 2;
      row.classList.add(before ? "drop-before" : "drop-after");
      drag.target = { row, before, zone: row.closest("[data-drop]") };
    } else if (zone) {
      zone.classList.add("over");
      drag.target = { zone };
    }
  }

  /* ---------------- Swipe a task row: right = done, left = clear / delete ---------------- */

  _swipeStart(event, path) {
    if (event.pointerType === "mouse" || this._ui.bulk || this._swipe) return;
    if (path.some((el) => el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.tagName === "A" || el.classList?.contains("dialog"))) return;
    const row = path.find((el) => el.classList?.contains("task-row"));
    if (!row?.dataset.uid || !this._idx.tasks.get(row.dataset.uid)) return;
    this._swipe = { uid: row.dataset.uid, row, startX: event.clientX, startY: event.clientY, dx: 0, active: false, pointerId: event.pointerId };
    window.addEventListener("pointermove", this._onSwipeMove);
    window.addEventListener("pointerup", this._onSwipeEnd);
    window.addEventListener("pointercancel", this._onSwipeEnd);
  }

  _onSwipeMove(event) {
    const swipe = this._swipe;
    if (!swipe || event.pointerId !== swipe.pointerId) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    if (!swipe.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return this._swipeReset(); // scrolling the list
      if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      swipe.active = true;
      swipe.row.classList.add("swiping");
    }
    const task = this._idx.tasks.get(swipe.uid);
    const width = swipe.row.offsetWidth || 300;
    // A blocked task can't be ticked: it resists a right swipe.
    swipe.dx = dx > 0 && task?.status === "blocked" ? Math.min(dx, 24) : Math.max(-width, Math.min(width, dx));
    const armed = Math.abs(swipe.dx) >= this._swipeThreshold(swipe.row);
    const done = task?.status === "completed";
    const label = swipe.dx > 0 ? (done ? "↺ Not done" : "✓ Done") : done && task?.recurrence_mode === "none" ? "Clear ✕" : "Delete 🗑";
    swipe.row.dataset.swipeLabel = label;
    swipe.row.classList.toggle("swipe-right", swipe.dx > 0);
    swipe.row.classList.toggle("swipe-left", swipe.dx < 0);
    swipe.row.classList.toggle("swipe-armed", armed);
    swipe.row.style.setProperty("--swipe", `${swipe.dx}px`);
    swipe.row.style.setProperty("--swipe-abs", `${Math.abs(swipe.dx)}px`);
  }

  _swipeThreshold(row) {
    return Math.min(120, (row.offsetWidth || 300) * 0.35);
  }

  async _onSwipeEnd(event) {
    const swipe = this._swipe;
    if (!swipe || (event.pointerId !== undefined && event.pointerId !== swipe.pointerId)) return;
    const { row, dx, active, uid } = swipe;
    this._swipeReset(false);
    if (!active) return;
    // The click that follows a swipe must not open or tick the row.
    this._suppressClick = true;
    setTimeout(() => {
      this._suppressClick = false;
    }, 60);
    const task = this._idx.tasks.get(uid);
    const commit = event.type === "pointerup" && Math.abs(dx) >= this._swipeThreshold(row) && task && !(dx > 0 && task.status === "blocked");
    row.classList.add("swipe-settle");
    row.style.setProperty("--swipe", commit ? `${dx > 0 ? row.offsetWidth : -row.offsetWidth}px` : "0px");
    await new Promise((resolve) => setTimeout(resolve, 180));
    const clean = () => {
      row.classList.remove("swiping", "swipe-settle", "swipe-left", "swipe-right", "swipe-armed");
      row.style.removeProperty("--swipe");
      row.style.removeProperty("--swipe-abs");
      delete row.dataset.swipeLabel;
    };
    if (!commit) return clean();
    if (dx > 0) {
      clean();
      return this._toggleTask(uid);
    }
    if (task.recurrence_mode !== "none" && !confirm(`Delete “${task.summary}” and all its repeats?`)) return clean();
    try {
      await this._clearTask(uid, task.status === "completed" && task.recurrence_mode === "none" ? "Cleared" : "Deleted");
    } catch (_err) {
      /* reported by _call; the row slides back */
    } finally {
      clean();
    }
  }

  _swipeReset(clearRow = true) {
    const swipe = this._swipe;
    this._swipe = null;
    window.removeEventListener("pointermove", this._onSwipeMove);
    window.removeEventListener("pointerup", this._onSwipeEnd);
    window.removeEventListener("pointercancel", this._onSwipeEnd);
    if (clearRow && swipe?.row) {
      swipe.row.classList.remove("swiping", "swipe-left", "swipe-right", "swipe-armed");
      swipe.row.style.removeProperty("--swipe");
      swipe.row.style.removeProperty("--swipe-abs");
    }
  }

  _clearDropMarks() {
    for (const el of this.shadowRoot.querySelectorAll(".drop-before, .drop-after, .drop.over")) {
      el.classList.remove("drop-before", "drop-after", "over");
    }
  }

  async _onPointerUp() {
    window.removeEventListener("pointermove", this._onPointerMove);
    const drag = this._drag;
    this._drag = null;
    if (!drag) return;
    this._clearDropMarks();
    drag.ghost?.remove();
    drag.row.classList.remove("dragging");
    if (!drag.active || !drag.target) return;
    this._suppressClick = true;
    setTimeout(() => {
      this._suppressClick = false;
    }, 50);
    const task = this._idx.tasks.get(drag.uid);
    if (!task) return;
    const { row, before, zone } = drag.target;
    const message = { type: "taskdragon/move_task", uid: drag.uid };
    if (row) {
      const target = this._idx.tasks.get(row.dataset.uid);
      if (target && target.plan_id === task.plan_id && target.parent_uid === task.parent_uid) {
        if (before) {
          const siblings = (this._idx.byPlan.get(task.plan_id) || []).filter((t) => t.uid !== task.uid);
          const index = siblings.findIndex((t) => t.uid === target.uid);
          message.previous_uid = index > 0 ? siblings[index - 1].uid : null;
        } else {
          message.previous_uid = target.uid;
        }
      }
    }
    if (zone) {
      const kind = zone.dataset.drop;
      const value = zone.dataset.value;
      if (kind === "bucket" && value !== (task.time_of_day_bucket || "anytime")) message.bucket = value;
      if (kind === "kanban") message.kanban_column = value;
      if (kind === "category" && value !== task.category) message.category = value;
      if (kind === "section" && (value || null) !== (task.section_id || null)) message.section_id = value || null;
      if (kind === "trip" && (value || null) !== (task.trip_id || null)) message.trip_id = value || null;
      if (kind === "trip-group") {
        const trip = zone.dataset.trip || null;
        if (trip !== (task.trip_id || null)) message.trip_id = trip;
        if (value !== (task.category || "Other")) message.category = value;
      }
      if (kind === "person") {
        const current = task.assigned_to.length === 1 ? task.assigned_to[0] : "pool";
        if (value !== current) message.assign_to = value === "pool" ? "pool" : value;
      }
    }
    if (Object.keys(message).length === 2 && !("previous_uid" in message)) return;
    if (!("previous_uid" in message)) message.previous_uid = (this._idx.byPlan.get(task.plan_id) || []).filter((t) => t.uid !== task.uid).slice(-1)[0]?.uid || null;
    if (message.kanban_column === "done") this._store.patchTask(drag.uid, { status: "completed" });
    try {
      await this._store.call(message);
    } catch (err) {
      this._fail(err);
      this._store.refresh();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sidebar panel                                                       */
/* ------------------------------------------------------------------ */

class TaskDragonPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; height: 100%; background: var(--primary-background-color); }
      .toolbar { display: flex; align-items: center; height: var(--header-height, 56px); padding: 0 12px; gap: 8px;
        background: var(--app-header-background-color, var(--primary-color)); color: var(--app-header-text-color, #fff);
        font-size: 20px; border-bottom: var(--app-header-border-bottom, none); box-sizing: border-box; }
      .wrap { max-width: 1400px; margin: 0 auto; height: calc(100% - var(--header-height, 56px)); overflow: auto; }`;
    // Static chrome built with DOM APIs (no markup strings at all).
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    this._menu = document.createElement("ha-menu-button");
    const title = document.createElement("div");
    title.textContent = "TaskDragon";
    toolbar.append(this._menu, title);
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    this._card = document.createElement("taskdragon-card");
    this._card.setAttribute("panel", "");
    wrap.append(this._card);
    this.shadowRoot.replaceChildren(style, toolbar, wrap);
  }

  set panel(panel) {
    const config = JSON.stringify(panel?.config || {});
    if (config === this._panelConfig) return;
    this._panelConfig = config;
    this._card.setConfig({ view_mode: "quick", title: "", ...(panel?.config || {}) });
  }

  set narrow(narrow) {
    this._narrow = narrow;
    if (this._menu) this._menu.narrow = narrow;
  }

  set hass(hass) {
    if (this._panelConfig === undefined) this.panel = { config: {} };
    if (this._menu) {
      this._menu.hass = hass;
      this._menu.narrow = this._narrow;
    }
    this._card.hass = hass;
  }
}

/* ------------------------------------------------------------------ */
/* Visual card editor                                                  */
/* ------------------------------------------------------------------ */

class TaskDragonCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._plans = null;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._plans === null) {
      this._plans = [];
      hass.connection
        .sendMessagePromise({ type: "taskdragon/get_board" })
        .then((board) => {
          this._plans = board.plans.filter((p) => !p.archived);
          this._render();
        })
        .catch(() => {});
    }
  }

  _render() {
    const c = this._config;
    const plans = this._plans || [];
    const selected = new Set(c.plans || []);
    const style = document.createElement("style");
    style.textContent = `
      .form { display: grid; gap: 12px; padding: 4px 0; }
      label { display: flex; flex-direction: column; gap: 4px; font-size: .85rem; color: var(--secondary-text-color); }
      label.inline { flex-direction: row; align-items: center; gap: 8px; color: var(--primary-text-color); }
      input, select { font: inherit; padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }
      .plans { display: flex; flex-wrap: wrap; gap: 4px 14px; }`;
    const container = document.createElement("div");
    const modes = [
      ["quick", "Quick List (default landing page)"],
      ["auto", "Auto (My Day if your user is a person, else family)"],
      ["personal", "Personal — My Day"],
      ["kiosk_split", "Kiosk — family split view"],
    ];
    setHTML(
      container,
      html`<div class="form">
        <label>Title<input data-key="title" value="${c.title ?? ""}" placeholder="TaskDragon"></label>
        <label>Opens on<select data-key="view_mode">${modes.map(([v, l]) => html`<option value="${v}" ${(c.view_mode || "quick") === v ? html`selected` : ""}>${l}</option>`)}</select></label>
        <label>Single plan (hides the category dropdown)<select data-key="plan"><option value="">— all plans —</option>
          ${plans.map((p) => html`<option value="${p.id}" ${c.plan === p.id ? html`selected` : ""}>${p.name}</option>`)}</select></label>
        <label>Categories in the dropdown (none = all)<span class="plans">${plans.map(
          (p) => html`<label class="inline"><input type="checkbox" data-plan="${p.id}" ${selected.has(p.id) ? html`checked` : ""}>${p.name}</label>`,
        )}</span></label>
        <label class="inline"><input type="checkbox" data-key="show_brain_dump" ${c.show_brain_dump !== false ? html`checked` : ""}>Show Brain Dump bar</label>
      </div>`,
    );
    this.shadowRoot.replaceChildren(style, ...container.childNodes);
    this.shadowRoot.querySelectorAll("[data-key]").forEach((el) => el.addEventListener("change", () => this._changed()));
    this.shadowRoot.querySelectorAll("[data-plan]").forEach((el) => el.addEventListener("change", () => this._changed()));
  }

  _changed() {
    const config = { ...this._config, type: this._config.type || "custom:taskdragon-card" };
    for (const el of this.shadowRoot.querySelectorAll("[data-key]")) {
      const key = el.dataset.key;
      const value = el.type === "checkbox" ? el.checked : el.value;
      if (value === "" || value === null) delete config[key];
      else config[key] = value;
    }
    const plans = [...this.shadowRoot.querySelectorAll("[data-plan]:checked")].map((el) => el.dataset.plan);
    if (plans.length) config.plans = plans;
    else delete config.plans;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

if (!customElements.get("taskdragon-card")) customElements.define("taskdragon-card", TaskDragonCard);
if (!customElements.get("taskdragon-panel")) customElements.define("taskdragon-panel", TaskDragonPanel);
if (!customElements.get("taskdragon-card-editor")) customElements.define("taskdragon-card-editor", TaskDragonCardEditor);
// Dashboards saved before the rename keep working until their YAML says taskdragon-card (not offered in the card picker).
if (!customElements.get("omniplan-card")) customElements.define("omniplan-card", class extends TaskDragonCard {});

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "taskdragon-card")) {
  window.customCards.push({
    type: "taskdragon-card",
    name: "TaskDragon",
    description: "Household planner: quick lists, My Day, family kiosk split, shopping aisles, kanban, maintenance, trip packing and pantry.",
    preview: false,
  });
}

console.info(`%c TASKDRAGON %c ${TD_VERSION} `, "background:#111;color:#fff;font-weight:700", "background:#eee;color:#111");
