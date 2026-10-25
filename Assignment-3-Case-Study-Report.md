# Assignment No. 3 — Case Study Report

## Smart Manufacturing OS Algorithm Visualizer

**Student:** ____________________  
**Roll No.:** ____________________  
**Course:** Operating Systems  
**Date:** 25 October 2026

---

## 1. Introduction
Smart manufacturing systems rely on embedded controllers that must schedule tasks, synchronize shared data, avoid deadlocks, and manage memory. This project is a browser-based visualizer that demonstrates four core Operating Systems algorithms in a manufacturing context: CPU scheduling, Producer–Consumer synchronization, Banker’s Algorithm, and First/Best Fit memory allocation.

## 2. Problem Statement
A smart factory has multiple concurrent tasks — sensor data acquisition, inspection, robotic control, and packaging. These tasks compete for CPU time, shared bounded storage, reusable resources (robotic arms, inspection units, conveyor controllers), and memory. Poor decisions can delay production, cause race conditions, deadlock, or allocation failures. The visualizer helps learners observe and verify the behavior of standard OS algorithms under these conditions.

## 3. System Design
The application is a single-page app built with HTML, CSS, and vanilla JavaScript. Modules are toggled via `showModule()`. All state is held in JavaScript variables; there is no backend.

Modules:
1. **CPU Scheduling** — process table, Gantt chart, metrics, compare view.
2. **Producer–Consumer** — bounded storage slots, event log, race-condition teaching mode.
3. **Banker’s Algorithm** — editable 5×3 matrices, Need calculation, safety check, request demo.
4. **Memory Management** — configurable blocks, request list, First/Best Fit visualization.
5. **Testing** — automated test runner.

## 4. CPU Scheduling
Algorithms implemented: **FCFS**, **non-preemptive SJF**, and **Round Robin**. Each run produces a Gantt chart and CT, TAT, WT, RT per process plus averages. Formulas: `TAT = CT − AT`, `WT = TAT − BT`, `RT = first start − AT`. A compare view runs all three and shows average metrics.

Sample run (processes P1(0,5), P2(1,3), P3(2,8), P4(3,6)) produces valid Gantt charts and metrics; Round Robin uses a configurable quantum (default 2).

## 5. Producer–Consumer Synchronization
Bounded storage of capacity N (default 10) holds produced items. Produce is blocked when storage is full (Empty semaphore = 0); consume is blocked when empty (Full semaphore = 0). A mutex protects the critical section. An event log records operations. Race-condition teaching mode demonstrates a lost update without synchronization (final count 1 instead of 2) and correct behavior with a mutex (final count 2).

## 6. Banker’s Algorithm
Five processes (P0–P4) and three resources (R1, R2, R3). Default safe example: Available = [3,3,2], with Allocation/Max matrices as in the README. Need = Max − Allocation. Safety check finds the sequence **P1 → P3 → P4 → P0 → P2**. An unsafe example (Available = [0,0,0]) is also provided. A resource-request demo grants a request only if the resulting state remains safe, otherwise it is rolled back.

## 7. Memory Management
Variable partitions with splitting. First Fit allocates to the first block large enough; Best Fit allocates to the smallest sufficient block. The visualizer shows resulting segments and allocation/failure counts for a configurable request list. Default blocks: 100, 500, 200, 300, 600.

## 8. Testing and Verification
The built-in suite runs 10 tests:
1. FCFS single process (WT=0, TAT=5)
2. FCFS average waiting time
3. SJF average waiting time
4. Round Robin average waiting time
5. Producer blocks when full
6. Consumer blocks when empty
7. Banker default safe sequence
8. Banker unsafe detection
9. First Fit allocation count
10. Race demo counts

All tests are expected to pass (10/10).

## 9. Conclusion
The visualizer successfully demonstrates the four algorithms with interactive inputs, visual feedback, and automated verification. It is suitable for classroom demonstration and self-study. Future work may add priority scheduling, paging/segmentation, and real concurrency via Web Workers.

## 10. References
1. Silberschatz, Galvin, Gagne — *Operating System Concepts*.
2. Tanenbaum — *Modern Operating Systems*.
3. MDN Web Docs — HTML, CSS, JavaScript.