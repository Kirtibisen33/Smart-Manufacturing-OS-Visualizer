# Smart Manufacturing OS Algorithm Visualizer

An interactive, browser-based educational simulator that demonstrates four core Operating Systems concepts in a Smart Manufacturing context: CPU scheduling, Producer–Consumer synchronization, Banker’s Algorithm (deadlock avoidance), and First Fit / Best Fit memory allocation.

## Features
- Single-page application built with **HTML, CSS, and vanilla JavaScript** (no backend, no dependencies).
- Dark navy / teal responsive theme.
- Dashboard with module cards and navigation.
- CPU scheduling: **FCFS**, **non-preemptive SJF**, and **Round Robin** with Gantt charts and CT/TAT/WT/RT metrics plus a compare view.
- Producer–Consumer: bounded storage slots, mutex/semaphore concept explanation, event log, and a race-condition teaching mode.
- Banker’s Algorithm: editable 5×3 Allocation/Max/Available matrices, Need calculation, safety check with safe sequence, and a resource-request demo.
- Memory management: configurable memory blocks, request list, **First Fit** and **Best Fit** with split visualization and comparison.
- Built-in automated test runner (10 tests) and a testing module.

## Project Structure
```
Smart-Manufacturing-OS-Visualizer/
├── index.html
├── style.css
├── script.js
├── README.md
└── report/
    └── Assignment-3-Case-Study-Report.md
```

## How to Run
1. Clone or download this repository.
2. Open the folder in VS Code.
3. Install the **Live Server** extension (optional but recommended).
4. Right-click `index.html` → **Open with Live Server**, or simply open `index.html` in any modern browser.
5. No build step, npm, or backend is required.

## Usage Guide
- **CPU Scheduling**: Add/edit/remove processes (ID, arrival time, burst time), then run FCFS/SJF/RR or Compare All. Adjust the time quantum for Round Robin.
- **Producer–Consumer**: Set storage capacity, produce/consume items, reset storage. Toggle Race-Condition Teaching Mode to see unsynchronized vs. synchronized outcomes.
- **Banker’s Algorithm**: Use “Reset to Default Example” or “Load Unsafe Example”, calculate the Need matrix, and run the safety check. Try the Resource Request Demo.
- **Memory Management**: Set memory blocks, add process requests, then run First Fit / Best Fit / Compare Both.
- **Testing**: Open the Testing module and click **Run Automated Tests**.

## Key Formulas
- Turnaround Time: `TAT = Completion Time − Arrival Time`
- Waiting Time: `WT = Turnaround Time − Burst Time`
- Response Time: `RT = First Start Time − Arrival Time`
- Need (Banker’s): `Need[i][j] = Max[i][j] − Allocation[i][j]`
- Safety check: a process can run if `Need[i] ≤ Work` for all resources; on completion `Work += Allocation[i]`.
- First Fit: allocate to the **first** block large enough.
- Best Fit: allocate to the **smallest** block large enough.

## Default Banker Example (Safe)
Allocation:
```
P0: 0 1 0
P1: 2 0 0
P2: 3 0 2
P3: 2 1 1
P4: 0 0 2
```
Max:
```
P0: 7 5 3
P1: 3 2 2
P2: 9 0 2
P3: 2 2 2
P4: 4 3 3
```
Available: `3 3 2`  
Safe sequence: **P1 → P3 → P4 → P0 → P2**

## Automated Tests
Open the **Testing** module and click **Run Automated Tests**. The suite covers:
1. FCFS single process (WT=0, TAT=5)
2. FCFS average waiting time
3. SJF average waiting time
4. Round Robin average waiting time
5. Producer blocks when storage is full
6. Consumer blocks when storage is empty
7. Banker default safe sequence
8. Banker unsafe example detection
9. First Fit allocation count
10. Race demo final counts

## Assumptions and Limitations
- Single-threaded educational simulation (no real OS threads, semaphores, or mutexes).
- Banker’s model uses a fixed 5-process × 3-resource example (editable).
- Memory model uses variable partitions with splitting; no compaction or paging.
- No persistent storage or backend; all state is in-memory.

## GitHub Steps
```bash
git init
git add .
git commit -m "Initial commit: Smart Manufacturing OS Visualizer"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
Then enable GitHub Pages (Settings → Pages → Deploy from branch → main / root) to publish the app.

## License
Educational use.