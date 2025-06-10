
import * as THREE from "../libs/three.js/build/three.module.js"
import JSON5 from "../libs/json5-2.1.3/json5.mjs";

export function loadDroppedPointcloud(cloudjsPath, callback){
	const folderName = cloudjsPath.replace(/\\/g, "/").split("/").reverse()[1];

	Potree.loadPointCloud(cloudjsPath).then(e => {
		let pointcloud = e.pointcloud;
		let material = pointcloud.material;

		pointcloud.name = folderName;

		viewer.scene.addPointCloud(pointcloud);

		let hasRGBA = pointcloud.getAttributes().attributes.find(a => a.name === "rgba") !== undefined
		if(hasRGBA){
			pointcloud.material.activeAttributeName = "rgba";
		}else{
			pointcloud.material.activeAttributeName = "color";
		}

		material.size = 1;
		material.pointSizeType = Potree.PointSizeType.ADAPTIVE;

		viewer.zoomTo(e.pointcloud);

		// Ejecuta el callback si fue pasado
        if (typeof callback === "function") {
            callback(pointcloud);
        }
	});
};

export function createPlaceholder(aabb){
	console.log("create placeholder");
	console.log(aabb);

	const placeholder = {};

	const node = new THREE.Object3D();
	
	const min = new THREE.Vector3(...aabb.min);
	const max = new THREE.Vector3(...aabb.max);
	const center = new THREE.Vector3(
		(min.x + max.x) / 2,
		(min.y + max.y) / 2,
		(min.z + max.z) / 2,
	);
	const radius = center.distanceTo(max);
	node.boundingSphere = new THREE.Sphere(center, radius);

	const text = new Potree.TextSprite("");
	text.position.copy(center);
	const textScale = radius / 5;
	text.material.depthTest = false;
	text.material.depthWrite = false;
	text.material.transparent = true;
	text.material.opacity = 0.7;
	text.scale.set(textScale, textScale, textScale);
	viewer.scene.scene.add(text);

	const box = new THREE.Box3(min, max);
	const box3 = new Potree.Box3Helper(box, 0xff0000);
	viewer.scene.scene.add(box3);

	const camera = viewer.scene.getActiveCamera();
	viewer.zoomTo(node);

	placeholder.text = text;
	placeholder.box = box3;
	placeholder.remove = () => {
		viewer.scene.scene.remove(box3);
		viewer.scene.scene.remove(text);
	};


	return placeholder;
}

export function convert_17(inputPaths, chosenPath, pointcloudName){
	let message = `Empezando conversión.<br>
	Entrada: ${inputPaths}<br>
	Salida: ${chosenPath}`;
	viewer.postMessage(message, {duration: 15000});

	const { spawn } = require('child_process');
	const path = require('path');
	const fs = require('fs');

	// Función para encontrar el ejecutable
	function findExecutable() {
		const possiblePaths = [
			// En desarrollo
			path.resolve('./libs/PotreeConverter/PotreeConverter.exe'),
			// En build empaquetado
			path.resolve(process.resourcesPath, 'PotreeConverter', 'PotreeConverter.exe'),
			// Alternativa en build
			path.resolve(__dirname, '..', 'PotreeConverter', 'PotreeConverter.exe'),
		];

		for (const exePath of possiblePaths) {
			console.log('Probando ruta:', exePath);
			if (fs.existsSync(exePath)) {
				console.log('Ejecutable encontrado en:', exePath);
				return exePath;
			}
		}

		throw new Error('No se pudo encontrar PotreeConverter.exe');
	}

	try {
		const exe = findExecutable();
		
		let parameters = [
			...inputPaths,
			"-o", chosenPath
		];

		console.log('Usando ejecutable:', exe);
		console.log('Parámetros:', parameters);

		const converter = spawn(exe, parameters);

		let placeholder = null;
		let outputBuffer = "";
		
		converter.stdout.on('data', (data) => {
			const string = new TextDecoder("utf-8").decode(data);
			console.log("stdout", string);
			outputBuffer += string;

			if(!placeholder){ 
				const regexp = /(.*AABB): ({[.\s\S]*?})/g;
				const matches = outputBuffer.matchAll(regexp);
					
				for (const match of matches) {
					try{
						const name = match[1];
						const aabb = JSON.parse(match[2]);
						console.log(aabb);

						if(name === "cubicAABB"){
							placeholder = createPlaceholder(aabb);
							placeholder.text.setText("0%");
							outputBuffer = "";
						}
					}catch(e){
						console.error(match[0]);
						console.error(e);
					}
				}
			}else{
				let regexp = /\[(\d+)%,/g;
				const matches = outputBuffer.replace(/'/g, "").matchAll(regexp);

				for(const match of matches){
					const percent = parseInt(match[1].replace(/\D/g,''));
					const text = `${percent}%`;
					placeholder.text.setText(text);
					outputBuffer = "";
				}
			}
		});

		converter.stderr.on('data', (data) => {
			console.log("==");
			console.error(`stderr: ${data}`);
		});

		converter.on('exit', (code) => {
			console.log(`child process exited with code ${code}`);

			const cloudJS = `${chosenPath}/metadata.json`;
			console.log("now loading point cloud: " + cloudJS);

			if(placeholder){
				placeholder.remove();
			}

			let message = `Conversión finalizada, ahora cargando ${cloudJS}`;
			viewer.postMessage(message, {duration: 15000});

			Potree.loadPointCloud(cloudJS).then(e => {
				let pointcloud = e.pointcloud;
				let material = pointcloud.material;

				pointcloud.name = pointcloudName;

				// Detectar el modo de visualización actual basándose en las nubes existentes
				let currentVisualizationMode = getCurrentVisualizationMode();
				
				// Aplicar la visualización según el modo actual
				applyVisualizationToPointcloud(pointcloud, currentVisualizationMode);

				material.size = 1;
				material.pointSizeType = Potree.PointSizeType.ADAPTIVE;

				viewer.scene.addPointCloud(pointcloud);
				//viewer.fitToScreen();
				viewer.zoomTo(e.pointcloud);
			});
		});

	} catch (error) {
		console.error('Error:', error.message);
		viewer.postMessage(`Error: ${error.message}`, {duration: 10000});
	}
}

export function convert_20(inputPaths, chosenPath, pointcloudName){
	let message = `Empezando conversión.<br>
	Entrada: ${inputPaths}<br>
	Salida: ${chosenPath}`;
	viewer.postMessage(message, {duration: 15000});

	const { spawn } = require('child_process');
	const path = require('path');
	const fs = require('fs');

	// Función para encontrar el ejecutable
	function findExecutable() {
		const possiblePaths = [
			// En desarrollo
			path.resolve('./libs/PotreeConverter2/PotreeConverter.exe'),
			// En build empaquetado
			path.resolve(process.resourcesPath, 'PotreeConverter2', 'PotreeConverter.exe'),
			// Alternativa en build
			path.resolve(__dirname, '..', 'PotreeConverter2', 'PotreeConverter.exe'),
		];

		for (const exePath of possiblePaths) {
			console.log('Probando ruta:', exePath);
			if (fs.existsSync(exePath)) {
				console.log('Ejecutable encontrado en:', exePath);
				return exePath;
			}
		}

		throw new Error('No se pudo encontrar PotreeConverter.exe');
	}

	try {
		const exe = findExecutable();
		
		let parameters = [
			...inputPaths,
			"-o", chosenPath
		];

		console.log('Usando ejecutable:', exe);
		console.log('Parámetros:', parameters);

		const converter = spawn(exe, parameters);

		let placeholder = null;
		let outputBuffer = "";
		
		converter.stdout.on('data', (data) => {
			const string = new TextDecoder("utf-8").decode(data);
			console.log("stdout", string);
			outputBuffer += string;

			if(!placeholder){ 
				const regexp = /(.*AABB): ({[.\s\S]*?})/g;
				const matches = outputBuffer.matchAll(regexp);
					
				for (const match of matches) {
					try{
						const name = match[1];
						const aabb = JSON.parse(match[2]);
						console.log(aabb);

						if(name === "cubicAABB"){
							placeholder = createPlaceholder(aabb);
							placeholder.text.setText("0%");
							outputBuffer = "";
						}
					}catch(e){
						console.error(match[0]);
						console.error(e);
					}
				}
			}else{
				let regexp = /\[(\d+)%,/g;
				const matches = outputBuffer.replace(/'/g, "").matchAll(regexp);

				for(const match of matches){
					const percent = parseInt(match[1].replace(/\D/g,''));
					const text = `${percent}%`;
					placeholder.text.setText(text);
					outputBuffer = "";
				}
			}
		});

		converter.stderr.on('data', (data) => {
			console.log("==");
			console.error(`stderr: ${data}`);
		});

		converter.on('exit', (code) => {
			console.log(`child process exited with code ${code}`);

			const cloudJS = `${chosenPath}/metadata.json`;
			console.log("now loading point cloud: " + cloudJS);

			if(placeholder){
				placeholder.remove();
			}

			let message = `Conversión finalizada, ahora cargando ${cloudJS}`;
			viewer.postMessage(message, {duration: 15000});

			Potree.loadPointCloud(cloudJS).then(e => {
				let pointcloud = e.pointcloud;
				let material = pointcloud.material;

				pointcloud.name = pointcloudName;

				// Detectar el modo de visualización actual basándose en las nubes existentes
				let currentVisualizationMode = getCurrentVisualizationMode();
				
				// Aplicar la visualización según el modo actual
				applyVisualizationToPointcloud(pointcloud, currentVisualizationMode);

				material.size = 1;
				material.pointSizeType = Potree.PointSizeType.ADAPTIVE;

				viewer.scene.addPointCloud(pointcloud);
				//viewer.fitToScreen();
				viewer.zoomTo(e.pointcloud);
			});
		});

	} catch (error) {
		console.error('Error:', error.message);
		viewer.postMessage(`Error: ${error.message}`, {duration: 10000});
	}
}

// Función para detectar el modo de visualización actual
function getCurrentVisualizationMode() {
	// Si hay nubes existentes, verificar su modo
	if (viewer.scene.pointclouds.length > 0) {
		const firstPointcloud = viewer.scene.pointclouds[0];
		const activeAttribute = firstPointcloud.material.activeAttributeName;
		
		console.log("Modo de visualización detectado:", activeAttribute);
		return activeAttribute;
	}
	
	// Si no hay nubes, usar el modo por defecto (puedes cambiarlo)
	return "rgba"; // o "classification" o "elevation"
}

// Función para aplicar la visualización a una nube específica
function applyVisualizationToPointcloud(pointcloud, mode) {
	console.log(`Aplicando modo ${mode} a la nube ${pointcloud.name}`);
	
	switch(mode) {
		case "rgba":
		case "color":
			// Verificar si tiene atributo RGBA
			let hasRGBA = pointcloud.getAttributes().attributes.find(a => a.name === "rgba") !== undefined;
			if(hasRGBA){
				pointcloud.material.activeAttributeName = "rgba";
			} else {
				pointcloud.material.activeAttributeName = "color";
			}
			// Aplicar clasificaciones si es necesario
			if (window.classificationEs) {
				viewer.setClassifications(window.classificationEs);
			}
			break;
			
		case "classification":
			pointcloud.material.activeAttributeName = "classification";
			// Aplicar las clasificaciones predefinidas
			viewer.setClassifications({
				0: { visible: false, name: 'Nunca clasificado', color: [160 / 255, 160 / 255, 160 / 255, 1.0] },
				1: { visible: false, name: 'No clasificado', color: [128 / 255, 128 / 255, 128 / 255, 1.0] },
				2: { visible: true, name: 'Suelo', color: [128 / 255, 64 / 255, 0, 1.0] },
				3: { visible: true, name: 'Baja vegetación', color: [0, 128 / 255, 0, 1.0] },
				4: { visible: true, name: 'Vegetación media', color: [0, 200 / 255, 0, 1.0] },
				5: { visible: true, name: 'Alta vegetación', color: [0, 255 / 255, 0, 1.0] },
				6: { visible: true, name: 'Construcción', color: [255 / 255, 128 / 255, 0, 1.0] },
				9: { visible: true, name: 'Agua', color: [0, 0, 255 / 255, 1.0] },
				10: { visible: true, name: 'Vías', color: [128 / 255, 128 / 255, 128 / 255, 1.0] },
				11: { visible: true, name: 'Camino', color: [128 / 255, 128 / 255, 128 / 255, 1.0] },
				12: { visible: true, name: 'Solapamiento', color: [255 / 255, 0, 255 / 255, 1.0] },
				13: { visible: true, name: 'Cable guardia', color: [255 / 255, 255 / 255, 0, 1.0] },
				14: { visible: true, name: 'Cable - Conductor', color: [255 / 255, 255 / 255, 0, 1.0] },
				15: { visible: true, name: 'Torre de transmisión', color: [0, 255 / 255, 255 / 255, 1.0] },
				17: { visible: true, name: 'Puente', color: [128 / 255, 128 / 255, 128 / 255, 1.0] },
				19: { visible: true, name: 'Parte alta estructura', color: [0, 255 / 255, 255 / 255, 1.0] },
				24: { visible: false, name: 'Ruido alto', color: [255 / 255, 0, 0, 1.0] },
				120: { visible: false, name: 'Default', color: [0, 128 / 255, 255 / 255, 1.0] },
				150: { visible: false, name: "Otro ruido", color: [255 / 255, 0, 0, 1.0] }
			});
			break;
			
		case "elevation":
			pointcloud.material.activeAttributeName = "elevation";
			break;
			
		default:
			// Si no reconoce el modo, aplicar RGB por defecto
			let hasRGBADefault = pointcloud.getAttributes().attributes.find(a => a.name === "rgba") !== undefined;
			if(hasRGBADefault){
				pointcloud.material.activeAttributeName = "rgba";
			} else {
				pointcloud.material.activeAttributeName = "color";
			}
			break;
	}
	
	pointcloud.material.needsUpdate = true;
}

export async function doConversion(inputPaths, suggestedDirectory, suggestedName){

	const fs = require("fs");
	const npath = require("path");
	const fsp = fs.promises;

	console.log("Open converter panel");
	console.log("input paths: ", inputPaths);
	console.log("suggested directory: ", suggestedDirectory);
	console.log("suggested name: ", suggestedName);

	let i = 1; 
	let suggestedPath = `${suggestedDirectory}/${suggestedName}`;
	while(fs.existsSync(suggestedPath)){
		suggestedPath = `${suggestedDirectory}/${suggestedName}_${i}`;
		i++;
	}


	let elPanel = document.getElementById("converter_panel");
	let elFiles = document.getElementById("converter_panel_files");
	let elTargetDir = document.getElementById("converter_panel_target_directory");
	let elTargetDirWarning = document.getElementById("converter_panel_target_directory_warning");
	// let elPickTargetDir = document.getElementById("converter_panel_pick_target_directory");
	let elCancel = document.getElementById("converter_panel_cancel");
	let elStart = document.getElementById("converter_panel_start");

	elPanel.style.display = "block";

	elTargetDir.value = suggestedPath;
	elFiles.innerHTML = inputPaths.map(file => `<div>${file}</div>`).join("\n");

	let checkTarget = () => {
		let targetDir = elTargetDir.value;

		try{
			let stat = fs.lstatSync(targetDir);

			if(stat.isDirectory()){
				let msg = `WARNING: the target folder already exists. Contents may be overriden.`;
				elTargetDirWarning.innerHTML = msg;
			}else{
				elTargetDirWarning.innerHTML = "&nbsp;";
			}
		}catch(e){
			elTargetDirWarning.innerHTML = "&nbsp;";
		}
	};

	elTargetDir.oninput = () => {
		checkTarget();
	};

	// elPickTargetDir.onclick = () => {
	// 	const dialog = require('electron').remote.dialog;
	// 	const chosenPath = dialog.showSaveDialogSync(null, {
	// 		title: "Chose Conversion Directory",
	// 		defaultPath: suggestedPath,
	// 		buttonLabel: "Select",
	// 		filters: [],
	// 		properties: ["openDirectory ", "promptToCreate", "createDirectory"],
	// 	});

	// 	if(chosenPath === undefined){
	// 		// keep old path
	// 	}else{
	// 		elTargetDir.value = chosenPath;
	// 	}

	// 	checkTarget();
	// };

	elCancel.onclick = () => {
		elPanel.style.display = "none";
	};

	elStart.onclick = () => {
		console.log("start conversion!!");

		let el_1_7 = document.getElementById("selection_converter_version_1_7");
		let el_2_0 = document.getElementById("selection_converter_version_2_0");

		let targetDirectory = elTargetDir.value;

		console.log("targetDirectory", targetDirectory);
		console.log("inputPaths", inputPaths);

		elPanel.style.display = "none";

		if(el_1_7.checked){
			console.log("convert 1.7");
			convert_17(inputPaths, targetDirectory, suggestedName);
		}else if(el_2_0.checked){
			// console.log("convert 2.0");
			convert_20(inputPaths, targetDirectory, suggestedName);
		}


	};
}


export function showDropzones(){
	let element = document.getElementById("pointcloud_file_dropzone");

	element.style.display = "block";
}

export function hideDropzones(){
	let element = document.getElementById("pointcloud_file_dropzone");

	element.style.display = "none";
}

export function dragEnter(e) {
	e.dataTransfer.dropEffect = 'copy';

	e.preventDefault();
	e.stopPropagation();

	console.log("enter");

	showDropzones();

	return false;
}

export function dragOver(e){
	e.preventDefault();
	e.stopPropagation();

	showDropzones();

	return false;
}

export function dragLeave(e){

	e.preventDefault();
	e.stopPropagation();

	hideDropzones();

	return false;
}

export async function dropHandler(event){
	// console.log(event);
	event.preventDefault();
	event.stopPropagation();

	hideDropzones();

	let u = event.clientX / document.body.clientWidth;

	console.log(u);

	const cloudJsFiles = [];
	const lasLazFiles = [];

	let suggestedDirectory = null;
	let suggestedName = null;

	for(let i = 0; i < event.dataTransfer.items.length; i++){
		let item = event.dataTransfer.items[i];

		if(item.kind !== "file"){
			continue;
		}

		let file = item.getAsFile();
		let path = file.path;

		const fs = require("fs");
		const fsp = fs.promises;
		const np = require('path');

		const whitelist = [".las", ".laz"];

		let isFile = fs.lstatSync(path).isFile();
		const isJson5 = file.name.toLowerCase().endsWith(".json5");

		if(isJson5){
			try{

				const text = await file.text();
				const json = JSON5.parse(text);

				if(json.type === "Potree"){
					Potree.loadProject(viewer, json);
				}
			}catch(e){
				console.error("failed to parse the dropped file as JSON");
				console.error(e);
			}
		}else if(isFile && path.indexOf("cloud.js") >= 0){
			cloudJsFiles.push(file.path);
		}else if(isFile && path.indexOf("metadata.json") >= 0){
			cloudJsFiles.push(file.path);
		}else if(isFile){
			const extension = np.extname(path).toLowerCase();

			if(whitelist.includes(extension)){
				lasLazFiles.push(file.path);

				if(suggestedDirectory == null){
					suggestedDirectory = np.normalize(`${path}/..`);
					suggestedName = np.basename(path, np.extname(path)) + "_converted";
				}
			}
		}else if(fs.lstatSync(path).isDirectory()){
			// handle directory

			console.log("start readdir!");
			const files = await fsp.readdir(path);

			console.log("readdir done!");

			for(const file of files){
				const extension = np.extname(file).toLowerCase();

				if(whitelist.includes(extension)){
					lasLazFiles.push(`${path}/${file}`);

					if(suggestedDirectory == null){
						suggestedDirectory = np.normalize(`${path}/..`);
						suggestedName = np.basename(path, np.extname(path)) + "_converted";
					}

				}else if(file.toLowerCase().endsWith("cloud.js")){
					cloudJsFiles.push(`${path}/${file}`);
				}else if(file.toLowerCase().endsWith("metadata.json")){
					cloudJsFiles.push(`${path}/${file}`);
				}

			};

			// lasLazFiles.push(path);

		}
	}

	// console.log(cloudJsFiles);
	// console.log(lasLazFiles);

	if(lasLazFiles.length > 0){
		doConversion(lasLazFiles, suggestedDirectory, suggestedName);
	}

	for(const cloudjs of cloudJsFiles){
		loadDroppedPointcloud(cloudjs);
	}

	// Setea el rgb del index que pusimos nosotros
	for(const cloudjs of cloudJsFiles){
		loadDroppedPointcloud(cloudjs, function(pc){
			// Detecta el modo actual de la PRIMERA nube para poner el mismo modo a la nueva nube
			const mode = viewer.scene.pointclouds[0]?.material.activeAttributeName;
			if (mode === "elevation") {
				window.setElevation();
			} else if (mode === "classification") {
				window.setClasif();
			} else {
				window.setRGB();
			}
		});
	}
	
	return false;
};