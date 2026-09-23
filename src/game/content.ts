export type TalkStep = {
  kind: "talk";
  npc: string;
  lines: string[];
  empty?: string;
  give?: string;
  need?: string;
  take?: boolean;
};

export type SpotStep = {
  kind: "spot";
  id: string;
  seconds: number;
  label: string;
  line: string;
};

export type SpotsStep = {
  kind: "spots";
  ids: string[];
  seconds: number;
  label: string;
  line: string;
};

export type Step = TalkStep | SpotStep | SpotsStep;

export type Quest = {
  id: string;
  title: string;
  giver: string;
  hook: string;
  intro: string[];
  steps: { objective: string; step: Step }[];
};

export type NpcTalk = {
  name: string;
  role: string;
  barks: string[];
  after?: string[];
};

export const NPC: Record<string, NpcTalk> = {
  diaz: {
    name: "Officer Diaz",
    role: "Officer",
    barks: [
      "Keep the aisle clear. Count is a habit, not a suggestion.",
      "I already gave you the list. Walk it.",
      "Hundred years is a number. The ledger is the one that moves.",
    ],
    after: ["Ledger's moving. Don't make me a liar.", "Pike has the chores now. I still walk this block."],
  },
  pike: {
    name: "Officer Pike",
    role: "Officer",
    barks: ["Spine's mine. Your list is Diaz's until he says otherwise.", "Don't lean on the rail."],
    after: ["You want a year, you take a job. I don't do speeches."],
  },
  brandt: {
    name: "Officer Brandt",
    role: "Officer",
    barks: ["The yard is a circle. Walk it or leave it.", "Hands out of pockets when I pass."],
  },
  quill: {
    name: "Officer Quill",
    role: "Officer",
    barks: ["Hands where I can count them.", "The mess is for eating. Not for business.", "Keep moving, 104."],
  },
  crowe: {
    name: "Warden Crowe",
    role: "Warden",
    barks: ["This office isn't a tour.", "If you don't have paper, you don't have me."],
    after: ["Pike has the chores. I have the drawer. Ives stays in it."],
  },
  moss: {
    name: "Moss",
    role: "Inmate",
    barks: ["Eyes on your own bunk, 104.", "I don't trade. I don't listen. I finish the day."],
  },
  rico: {
    name: "Rico",
    role: "Inmate",
    barks: ["Not buying.", "You new, you quiet. That's the whole welcome."],
    after: ["Spoon's gone. Don't grow a new habit in my cell."],
  },
  abe: {
    name: "Abe",
    role: "Inmate",
    barks: [
      "I got here when the radios were wood. The years still fit in one hand if you count them wrong.",
      "Sit if you're going to talk. Standing makes you look like a request.",
    ],
  },
  drew: {
    name: "Drew",
    role: "Inmate",
    barks: ["Walk.", "I said walk."],
  },
  cole: {
    name: "Cole",
    role: "Inmate",
    barks: ["Don't touch the bunk.", "If you're not holding paper, you're holding nothing I want."],
    after: ["She wrote. That's enough for this month."],
  },
  nia: {
    name: "Nia",
    role: "Inmate",
    barks: ["Chapter twelve. You're not in it.", "The library cart is Thursday. Today is not Thursday."],
    after: ["The margin had a name. You already carried it."],
  },
  voss: {
    name: "Voss",
    role: "Inmate",
    barks: ["You blink too much.", "Names scratched in paint are for people with time. You have time."],
  },
  hank: {
    name: "Hank",
    role: "Inmate",
    barks: ["Iron's busy.", "If you came to watch, watch from over there."],
    after: ["Bench is Willis's. Bar is mine. Don't mix them up."],
  },
  jules: {
    name: "Jules",
    role: "Inmate",
    barks: ["He's not done.", "Count it or don't talk."],
  },
  willis: {
    name: "Willis",
    role: "Inmate",
    barks: ["Bench is taken.", "Sun's working. Don't stand in it."],
    after: ["Tell Marla I ate. She worries like a clerk."],
  },
  pat: {
    name: "Pat",
    role: "Inmate",
    barks: ["Sun's the only thing they can't inventory.", "I don't do errands. I do this bench."],
  },
  lena: {
    name: "Lena",
    role: "Inmate",
    barks: ["I eat. I don't recruit.", "South table. That's the whole biography."],
    after: ["You already heard it. Hearing it twice makes it a rumor about you."],
  },
  birdie: {
    name: "Birdie",
    role: "Inmate",
    barks: ["Sit or don't. The seat's not a promise.", "Go bother the tray line."],
  },
  ken: {
    name: "Ken",
    role: "Inmate",
    barks: ["Food's food. Don't review it.", "I'm chewing. That's the conversation."],
  },
  marla: {
    name: "Marla",
    role: "Trustee",
    barks: ["Bell hasn't rung for you.", "If it isn't a tray or a spoon, it's not my problem."],
    after: ["Willis ate. You can stop announcing it."],
  },
  reed: {
    name: "Reed",
    role: "Inmate",
    barks: [
      "Water's cold. That's the whole luxury.",
      "Three minutes. They count it. I don't.",
      "Don't leave soap in the drain. They blame the whole row.",
    ],
  },
};

export type Faction = "admin" | "inmate";

export type Errand = {
  id: string;
  title: string;
  giver: string;
  faction: Faction;
  intro: string[];
  task: string;
  back: string;
  kind: "spot" | "talk";
  spotId?: string;
  seconds?: number;
  workLabel?: string;
  workLine?: string;
  npc?: string;
  npcLines?: string[];
  report: string[];
  carry?: string;
};

export const ERRANDS: Errand[] = [
  {
    id: "bowl-104",
    title: "Bowl 104",
    giver: "diaz",
    faction: "admin",
    intro: [
      "Kane. The century is still on you. Administration pays in years, and the yard charges respect.",
      "Scrub the bowl in your cell, south-west, number 104. Then come back and say it will pass a count.",
    ],
    task: "Scrub the toilet in cell 104, south-west corner.",
    back: "Report the scrub to Officer Diaz.",
    kind: "spot",
    spotId: "toilet-kane",
    seconds: 2.4,
    workLabel: "Scrubbing",
    workLine: "The bowl gives up. Diaz is still walking the block.",
    report: ["It'll pass a count. One year off the book. Two points of respect, gone. Don't look at me like I invented the trade."],
  },
  {
    id: "rico-spoon",
    title: "The spoon",
    giver: "diaz",
    faction: "admin",
    intro: [
      "Another year if you can walk a straight question.",
      "Rico, west row, third cell up. Ask if the bent spoon is still under the mattress. Bring me the answer, not a lecture.",
    ],
    task: "Ask Rico, west row, about the bent spoon.",
    back: "Tell Officer Diaz what Rico said.",
    kind: "talk",
    npc: "rico",
    npcLines: [
      "Still under the mattress. Bent. Mine until Marla learns to count without hunting people.",
      "Tell Diaz that. I'm not walking it to him.",
    ],
    report: ["Under the mattress. Noted. Year off. The block just liked you a little less."],
  },
  {
    id: "mess-mop",
    title: "Aisle mop",
    giver: "pike",
    faction: "admin",
    intro: [
      "Spine's mine. Your century is Crowe's hobby.",
      "Mess aisle is a hazard. Mop it. Then find me back on this corridor.",
    ],
    task: "Mop the open aisle in the mess hall.",
    back: "Report the mop to Officer Pike on the Spine.",
    kind: "spot",
    spotId: "mop",
    seconds: 2.5,
    workLabel: "Mopping",
    workLine: "The aisle looks less like a complaint. Pike is on the Spine.",
    report: ["Counted. One year. Respect drops. That's the uniform's price."],
  },
  {
    id: "abe-bowl",
    title: "Abe's bowl",
    giver: "pike",
    faction: "admin",
    intro: ["North-west cell. Abe calls the stain history. Scrub the history. Don't debate him. Then report."],
    task: "Scrub the toilet in Abe's cell, north-west.",
    back: "Tell Officer Pike the history is gone.",
    kind: "spot",
    spotId: "toilet-abe",
    seconds: 2.4,
    workLabel: "Scrubbing",
    workLine: "The stain loses. Abe can keep the story. Pike wants the report.",
    report: ["History survives. The stain doesn't. Year off. Two respect, docked."],
  },
  {
    id: "south-wipe",
    title: "South tables",
    giver: "quill",
    faction: "admin",
    intro: ["South tables. Marla's people miss the corners on purpose. Wipe them. I'm on the tray line when you're done."],
    task: "Wipe the south tables in the mess.",
    back: "Report the tables to Officer Quill.",
    kind: "spot",
    spotId: "wipe",
    seconds: 2.2,
    workLabel: "Wiping",
    workLine: "Corners done. Quill is still by the trays.",
    report: ["Clean enough to lie about. A year comes off. Respect goes with it."],
  },
  {
    id: "yard-paper",
    title: "One pile",
    giver: "brandt",
    faction: "admin",
    intro: ["South-east yard. One pile of paper acting like a person. Pick it up. Then find me on the fence walk."],
    task: "Pick up the marked paper pile in the south-east yard.",
    back: "Tell Officer Brandt the pile is gone.",
    kind: "spot",
    spotId: "trash-a",
    seconds: 1.8,
    workLabel: "Collecting",
    workLine: "Paper's in your hands and then it isn't. Brandt walks the fence.",
    report: ["Tide's down by one. Year off. The yard will hear you helped the uniform."],
  },
  {
    id: "blotter",
    title: "The blotter",
    giver: "crowe",
    faction: "admin",
    intro: [
      "This office isn't a tour. The ledger is.",
      "Leave this slip on the desk in the middle of the block. Then come back here, west of the Spine.",
    ],
    task: "Leave the slip on the cell-block desk.",
    back: "Return to Warden Crowe in the office.",
    kind: "spot",
    spotId: "desk",
    seconds: 2,
    workLabel: "Filing",
    workLine: "The slip sits on the blotter. Crowe's door is west off the corridor.",
    report: ["Filed. One year leaves the century. Two respect leave you. Both are arithmetic."],
  },
  {
    id: "margin-name",
    title: "The margin",
    giver: "crowe",
    faction: "admin",
    intro: [
      "Nia reads what she shouldn't. East row, third cell from the south.",
      "Ask what name is written in the margin of the dock invoice. Bring the word back. Not the book.",
    ],
    task: "Ask Nia, east row, about the name in the margin.",
    back: "Tell Warden Crowe the name.",
    kind: "talk",
    npc: "nia",
    npcLines: [
      "Crowe sent a stranger. He must be bored.",
      "The margin says Ives. He paid for a match and a clerk who would stay quiet. That's the whole scrap.",
    ],
    report: ["Ives. It stays in the drawer. A year comes off. Don't expect the yard to applaud."],
  },
  {
    id: "honest-reps",
    title: "Honest reps",
    giver: "hank",
    faction: "inmate",
    intro: [
      "Officers shave years. We don't. A job for me adds a year and pays respect. Two points. That's the school.",
      "The bar is right behind me. Stay on it until the work is honest. Then tell me your elbows answered.",
    ],
    task: "Work the weight bar on the east side of the yard.",
    back: "Tell Hank the reps were honest.",
    kind: "spot",
    spotId: "weights",
    seconds: 2.6,
    workLabel: "Working the bar",
    workLine: "Your arms answer. Hank is still on the iron.",
    report: ["Honest. The year goes back on the book. Respect goes up. Remember which one you can spend."],
  },
  {
    id: "willis-bench",
    title: "The bench",
    giver: "willis",
    faction: "inmate",
    intro: [
      "Hank's crew shadows this bench. Tell him it's mine until night count. He's east, on the iron.",
      "Then come back and sit the news down. This isn't an officer's errand. It costs a year. It buys respect.",
    ],
    task: "Tell Hank the west bench is Willis's until count.",
    back: "Report back to Willis on the west bench.",
    kind: "talk",
    npc: "hank",
    npcLines: ["Willis used you as the mouth. Tell him the bench is his. I'm here to lift, not to tan."],
    report: ["He heard you. That's enough. A year back on the sentence. Two respect in your pocket."],
  },
  {
    id: "tray-word",
    title: "Tray word",
    giver: "marla",
    faction: "inmate",
    intro: [
      "Willis won't come inside to eat. West benches, through the yard.",
      "Tell him the tray is from me and he eats. Then tell me he heard it. Yard business. Not the ledger's.",
    ],
    task: "Tell Willis on the west benches that Marla's tray is waiting.",
    back: "Report to Marla at the serving line.",
    kind: "talk",
    npc: "willis",
    npcLines: ["Marla. She remembers who eats. Tell her I heard. I don't do speeches."],
    report: ["He'll eat or he won't. You carried the word. Year on. Respect up."],
  },
  {
    id: "sister-page",
    title: "Sister's page",
    giver: "cole",
    faction: "inmate",
    intro: [
      "My sister's letter walked off. East mess table, underneath.",
      "Find it and bring it here. Not to a uniform. This adds a year. I'd rather have the page.",
    ],
    task: "Search under the east table in the mess for Cole's letter.",
    back: "Bring the letter back to Cole, east row.",
    kind: "spot",
    spotId: "letter",
    seconds: 2.2,
    workLabel: "Searching",
    workLine: "A folded page. His sister's hand. Cole is in the east row.",
    carry: "Folded letter",
    report: ["You found it. Last line is mine. The year goes back on you. Respect, too. Don't read it twice."],
  },
  {
    id: "early-count",
    title: "Early count",
    giver: "rico",
    faction: "inmate",
    intro: ["Moss is south of me on this row. Tell him count is early tonight. Then come back so I know you said it out loud."],
    task: "Tell Moss, south-west cell, that count is early.",
    back: "Report back to Rico.",
    kind: "talk",
    npc: "moss",
    npcLines: ["Early. Figures. Tell Rico I heard it. I'm not running."],
    report: ["Good. You said it. That's a year back on the book and two respect. Don't dress it up."],
  },
  {
    id: "second-tray",
    title: "Second tray",
    giver: "lena",
    faction: "inmate",
    intro: ["Ken is up by the pots. Ask if the second tray is still hot. Bring the answer here, south table. Not to Quill."],
    task: "Ask Ken by the pots if the second tray is still hot.",
    back: "Tell Lena what Ken said.",
    kind: "talk",
    npc: "ken",
    npcLines: ["Hot enough. Tell Lena to stop sending messengers and start sending appetites."],
    report: ["Hot enough. I'll eat it before it becomes a rumor. Year on you. Respect on you. Fair trade."],
  },
  {
    id: "worth-a-year",
    title: "Worth a year",
    giver: "abe",
    faction: "inmate",
    intro: [
      "Pat sits the north benches. Ask him if the sun is still worth a year.",
      "Then come tell me. I don't send people to officers. Officers send people to me.",
    ],
    task: "Ask Pat on the north yard benches about the sun.",
    back: "Bring Pat's answer to Abe.",
    kind: "talk",
    npc: "pat",
    npcLines: ["The sun's the only thing they can't inventory. Tell Abe it's still worth a year. I've paid worse."],
    report: ["Worth a year. So are you, today. The sentence grows. So does your name in here."],
  },
  {
    id: "left-stall",
    title: "Left stall",
    giver: "nia",
    faction: "inmate",
    intro: ["Reed is in the showers, west of the Spine. Ask if the left stall is free. Then come back with a yes or a no. I don't do lines."],
    task: "Ask Reed in the showers if the left stall is free.",
    back: "Tell Nia what Reed said.",
    kind: "talk",
    npc: "reed",
    npcLines: ["Left stall's free if you don't mind the drip. Tell Nia three minutes, and not to leave soap in the drain."],
    report: ["Free, with a drip. I'll take it. Your year ticks up. So does your standing. Don't spend both at once."],
  },
  {
    id: "magazine",
    title: "The magazine",
    giver: "voss",
    faction: "inmate",
    intro: ["Drew paces the south-east cell. Tell him I want my magazine back. Then tell me what his face did."],
    task: "Tell Drew, south-east cell, that Voss wants the magazine.",
    back: "Report Drew's answer to Voss.",
    kind: "talk",
    npc: "drew",
    npcLines: ["Magazine's under the bunk. He can have it when I'm done with the pictures. Tell him that, not a speech."],
    report: ["Under the bunk. He'll finish the pictures. You did the walking. Year on. Respect on."],
  },
  {
    id: "second-roll",
    title: "Second roll",
    giver: "birdie",
    faction: "inmate",
    intro: ["Marla runs the pots. Ask her for a second roll, from me. Then come back to this seat with the answer. I don't stand in lines."],
    task: "Ask Marla for a second roll for Birdie.",
    back: "Tell Birdie what Marla said.",
    kind: "talk",
    npc: "marla",
    npcLines: ["Birdie already ate. She can have a heel if the bell stays quiet. Tell her that and don't negotiate."],
    report: ["A heel. That's a feast in her mouth. You carried it. The year comes back. Respect, two points."],
  },
  {
    id: "quiet-bench",
    title: "Quiet bench",
    giver: "pat",
    faction: "inmate",
    intro: ["Jules is counting reps with Hank. Tell him the north bench stays quiet. No shouting sets. Then come back to the sun."],
    task: "Tell Jules the north bench stays quiet.",
    back: "Report to Pat on the north bench.",
    kind: "talk",
    npc: "jules",
    npcLines: ["Quiet. We count under our breath already. Tell Pat the north bench is his church."],
    report: ["His church. Good. Sit a minute if you want. The year is back on you. Respect too."],
  },
  {
    id: "false-radio",
    title: "False radio",
    giver: "moss",
    faction: "inmate",
    intro: ["Cole, east row, second cell from the south. Tell him the radio rumor is false. Then come back and say you said it. I don't write notes."],
    task: "Tell Cole the radio rumor is false.",
    back: "Report back to Moss.",
    kind: "talk",
    npc: "cole",
    npcLines: ["False. Good. I was about to owe somebody a story. Tell Moss I heard him."],
    report: ["He heard it. That's the job. Century gets heavier by one. Your name gets heavier by two."],
  },
];

export const LOOK_LINES: Record<string, { name: string; lines: string[] }> = {
  board: {
    name: "Notice board",
    lines: ["Count is at dusk. The rest of the board is peeling paint.", "A corner says SHOWERS — west of the Spine, past the Warden."],
  },
  fountain: {
    name: "Fountain",
    lines: ["The fountain coughs once, then gives up. You drink anyway.", "It tastes like the pipe. That's still water."],
  },
  pots: {
    name: "Serving pots",
    lines: ["The pots are hotter than the food.", "Marla's ladle has a chip. Nobody mentions it."],
  },
  pullup: {
    name: "Pull-up bar",
    lines: ["The bar is slick. Somebody already put their morning into it.", "North fence. The wire above doesn't care how many you do."],
  },
  dips: {
    name: "Dip bars",
    lines: ["Parallel bars. The yard's idea of a chapel.", "Paint's gone where the hands go."],
  },
  planter: {
    name: "Planter",
    lines: ["The only green the state signed for, and it still showed up.", "Don't pick the leaves. Brandt writes it down."],
  },
  locker: {
    name: "Spine locker",
    lines: ["Pike's locker. It doesn't open for you.", "A dent the shape of a boot. You leave it."],
  },
  stall: {
    name: "Shower stall",
    lines: ["The head drips on a count of its own.", "Cold. The drain keeps whatever you drop."],
  },
  rack: {
    name: "Weight rack",
    lines: ["The plates don't match. Nobody's reported it.", "Hank has the other rack. This one is for whoever gets here first."],
  },
};
