import { describeStorageAdapterConformance } from "./conformance";
import { memory } from "../../src/storage/memory";

describeStorageAdapterConformance("memory", () => memory());
