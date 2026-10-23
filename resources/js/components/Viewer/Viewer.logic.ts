import { onMounted, ref } from "vue";

import * as OBC from "@thatopen/components";

import * as FRAGS from "@thatopen/fragments";

import FloatingMenu from '../FloatingMenu/FloatingMenu.vue';

import { processIfcFile } from '../../services/ifc-processor';

export function useViewer<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>() {
  const containerRef = ref<HTMLDivElement|null>(null);

  const ifcInput = ref<HTMLInputElement | null>(null);

  const fragInput = ref<HTMLInputElement | null>(null);

  const showModal = ref(false);

  const fragmentName = ref("model");

  const isLoading = ref(false);

  const loadingFileName = ref('');

  let world: any;

  let fragments: any;

  let serializer: any;

  let fragmentBytes: ArrayBuffer | null = null;

  let model: FRAGS.FragmentsModel | undefined = undefined;

  //export let selector : IfcSelector | null = null
  
  onMounted(async () => {
      if (!containerRef.value) return;
  
      const components = new OBC.Components();
      const worlds = components.get(OBC.Worlds);
      world = worlds.create<
      OBC.SimpleScene,
      OBC.SimpleCamera,
      OBC.SimpleRenderer>();
  
      world.scene = new OBC.SimpleScene(components);
      world.scene.three.background = null;
      
      world.renderer = new OBC.SimpleRenderer(components, containerRef.value);
      world.camera = new OBC.OrthoPerspectiveCamera(components);
      
      components.init();
      world.camera.controls.setLookAt(-60, 30, -20, 0, 0, -20);
  
      world.scene.setup();
  
      const grids = components.get(OBC.Grids);
      grids.create(world);
  
      serializer = new FRAGS.IfcImporter();
      serializer.wasm = {
          absolute: true,
          path: "https://unpkg.com/web-ifc@0.0.68/",
      };
  
      const workerUrl = "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
      const fetchedWorker = await fetch(workerUrl);
      const workerText = await fetchedWorker.text();
      const workerFile = new File([new Blob([workerText])], "worker.mjs", {
          type: "text/javascript",
      });
      
      const workerBlobUrl = URL.createObjectURL(workerFile);
      fragments = new FRAGS.FragmentsModels(workerBlobUrl);
  });

  const handleLoadIfc = () => {
      ifcInput.value?.click();
  };

  const handleLoadFrag = () => {
      fragInput.value?.click();
  };

  const handleClear = async() => {
      const ids = [...fragments.models.list.values()].map((m: any) => m.modelId);
      for (const id of ids) {
          await fragments.disposeModel(id);
      }
  };

  const onIfcFileChange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
  
      isLoading.value = true;
      loadingFileName.value = file.name;
  
      try {
          const generatedBytes = await processIfcFile(file, {
              wasmPath: "https://unpkg.com/web-ifc@0.0.68/",
          });
          const firstBytes = Array.isArray(generatedBytes) ? generatedBytes[0] : generatedBytes;
          fragmentBytes = firstBytes.buffer as ArrayBuffer;
  
          world.camera.controls.addEventListener("rest", () => fragments?.update(true));
          world.camera.controls.addEventListener("update", () => fragments?.update());
          model = await fragments.load(fragmentBytes, { modelId: file.name });
          model?.useCamera(world.camera.three);
          world.scene.three.add(model?.object);
          await fragments.update(true);
          console.log(`[IFC] Successfully loaded 3D fragments for: ${file.name}`);
      } catch (err) {
          console.error("Failed to load IFC:", err);
          alert(`Failed to load IFC file: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
          isLoading.value = false;
          if (e.target) {
              (e.target as HTMLInputElement).value = '';
          }
      }
  };

  const onFragFileChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
  
      isLoading.value = true;
      loadingFileName.value = file.name;
  
      try{
      
          world.camera.controls.addEventListener("rest", () => fragments?.update(true));
          world.camera.controls.addEventListener("update", () => fragments?.update());
      
          const buffer = await file.arrayBuffer();
          const model = await fragments.load(buffer, { modelId: "example" });
          model.useCamera(world.camera.three);
          world.scene.three.add(model.object);
          await fragments.update(true);
          const tree = await model.getSpatialStructure()
          console.log(tree)
      } catch (err) {
          console.error("Failed to load IFC:", err);
          alert("Error loading file");
      }finally{
          isLoading.value = false;
      }
  };

  const handleDownloadFrag = () => {
    if (!fragmentBytes) {
      alert("No fragment loaded yet.");
      return;
    }
    showModal.value = true;
  };

  const downloadFragment = () => {
    if (!fragmentBytes) 
    {
      console.error("No fragments to download.");
      return;
    }
    const blob = new Blob([fragmentBytes], { type: "application/octet-stream" });
    const file = new File([blob], `${fragmentName.value || 'model'}.frag`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
    showModal.value = false;
  };

  return {
    onMounted,
    ref,
    OBC,
    FRAGS,
    FloatingMenu,
    processIfcFile,
    containerRef,
    ifcInput,
    fragInput,
    showModal,
    fragmentName,
    isLoading,
    loadingFileName,
    world,
    fragments,
    serializer,
    fragmentBytes,
    model,
    handleLoadIfc,
    handleLoadFrag,
    handleClear,
    onIfcFileChange,
    onFragFileChange,
    handleDownloadFrag,
    downloadFragment,
  };
}
