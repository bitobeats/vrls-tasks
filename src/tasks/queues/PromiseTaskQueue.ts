import type { Task } from "../types/Task";
import type { CallbacksArray } from "../types/CallbacksArray";

import { SimpleEventTarget } from "@bitobeats/simple-event-target";

import { createTask } from "../createTask";

type EnqueueMultipleReturn<T extends CallbacksArray> = { [K in keyof T]: ReturnType<T[K]> };
type EventsMap = {
  queuefinished: () => void;
};

/**
 * A task queue that runs callbacks as soon as they are enqueued,
 * in order, waiting for the current one to finish before starting the next one.
 */
export class PromiseTaskQueue extends SimpleEventTarget<EventsMap> {
  #queue: Task<any>[] = [];
  #isRunning = false;

  constructor() {
    super(["queuefinished"]);
  }

  get isRunning() {
    return this.#isRunning;
  }

  enqueue<T>(callback: () => Promise<T>) {
    const task = createTask(callback);
    this.#queue.push(task);

    this.#runTasks();
    return task.controlPromise;
  }

  enqueueMultiple<T extends CallbacksArray>(callbacks: [...T]): EnqueueMultipleReturn<T> {
    const promises: Promise<any>[] = [];

    callbacks.forEach((callback) => {
      const task = createTask(callback);
      promises.push(task.controlPromise);
      this.#queue.push(task);
    });

    this.#runTasks();
    return promises as EnqueueMultipleReturn<T>;
  }

  async #runTasks() {
    if (this.#isRunning) {
      return;
    }

    this.#isRunning = true;

    while (this.#queue.length) {
      const currentTask = this.#queue.shift();

      try {
        const taskResult = await currentTask?.callback();
        currentTask?.resolve(taskResult);
      } catch (error) {
        currentTask?.reject(error);
      }
    }
    this.#isRunning = false;
    this.dispatchEvent("queuefinished");
  }
}
