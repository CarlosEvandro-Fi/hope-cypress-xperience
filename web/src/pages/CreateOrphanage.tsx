import React, { ChangeEvent, FormEvent, useState, useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';

import * as Yup from 'yup';
import Swal from 'sweetalert2'

import { FiPlus, FiX } from "react-icons/fi";

import Sidebar from '../components/Sidebar';
import mapIcon from '../utils/mapIcon';
import api from '../services/api';

import '../styles/pages/create-orphanage.css';

interface PreviewImage {
  name: string;
  url: string;
}

const dataSchema = Yup.object().shape({
  name: Yup.string().required('Campo obrigatório'),
  description: Yup.string().max(300, 'Descrição muito longa, informe até 300 caracteres').required('Campo obrigatório'),
  location: Yup
    .object()
    .test('validator-location', function (location: any) {
      if ((!location.latitude || location.latitude === 0) || (!location.longitude || location.longitude === 0)) {
        return this.createError({
          path: this.path,
          message: 'Informe a localizaçao no mapa',
        });
      } else {
        return true;
      }
    }),
  images: Yup
    .array<PreviewImage[]>()
    .max(5, 'Adicione até 5 fotos')
    .test('validator-images ', function (images: any) {
      if (images.length <= 0) {
        return this.createError({
          path: this.path,
          message: 'Envie pelo menos uma foto',
        });
      } else {
        return true;
      }
    }),
  opening_hours: Yup.string().required('Campo obrigatório'),
});

interface ILocation {
  latitude: number;
  longitude: number;
}


export default function OrphanagesMap() {
  const navigate = useNavigate();
  
  const [loadPosition, setLoadPosition] = useState<ILocation>();
  const [selectedPosition, setSelectedPosition] = useState<[number, number]>([0, 0]);


  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [opening_hours, setOpeningHours] = useState('');
  const [open_on_weekends, setOpenOnWeekends] = useState(true);
  const [images, setImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);

  const [alertName, setAlertName] = useState('')
  const [alertDescription, setAlertDescription] = useState('')
  const [alertPosition, setAlertPosition] = useState('')
  const [alertImages, setAlertImages] = useState('')
  const [alertOh, setAlertOh] = useState('')

  useEffect(() => {

    navigator.permissions
      .query({ name: "geolocation" })
      .then(function (result) {
        navigator.geolocation.getCurrentPosition(function (geo) {
          setLoadPosition(geo.coords)
        })

        result.onchange = function () {
          console.log(result.state);
        }
      })

  }, []);

  const Markers = () => {
    useMapEvents({
      click(e) {
        setSelectedPosition([
          e.latlng.lat,
          e.latlng.lng
        ]);
      },
    })

    return (
      selectedPosition ?
        <Marker
          key={selectedPosition[0]}
          position={selectedPosition}
          icon={mapIcon}
          interactive={false}
        />
        : null
    )
  }

  function handleSelectImages(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files) {
      return;
    }
    const selectedImages = Array.from(event.target.files);

    event.target.value = "";

    setImages(selectedImages);

    const selectedImagesPreview = selectedImages.map(image => {
      return { name: image.name, url: URL.createObjectURL(image) };
    });

    setPreviewImages(selectedImagesPreview);
  }

  function handleRemoveImage(image: PreviewImage) {
    setPreviewImages(
      previewImages.map((image) => image).filter((img) => img.url !== image.url)
    );
    setImages(
      images.map((image) => image).filter((img) => img.name !== image.name)
    );
  }

  function resetAlerts() {
    setAlertName('')
    setAlertDescription('')
    setAlertPosition('')
    setAlertImages('')
    setAlertOh('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    resetAlerts()

    const payload = {
      name,
      description,
      location: {
        latitude: selectedPosition[0] ? selectedPosition[0] : 0,
        longitude: selectedPosition[1] ? selectedPosition[1] : 0,
      },
      images,
      opening_hours
    }

    try {
      await dataSchema.validate(payload, { abortEarly: false })
    } catch (error) {

      if (error instanceof Yup.ValidationError) {
        error.inner.forEach((e: any) => {

          console.log(e.path)

          switch (e.path) {
            case 'name':
              setAlertName(e.message)
              break
            case 'description':
              setAlertDescription(e.message)
              break
            case 'location':
              setAlertPosition(e.message)
              break
            case 'images':
              setAlertImages(e.message)
              break
            case 'opening_hours':
              setAlertOh(e.message)
              break
          }
        });
      }
      return
    }

    const data = new FormData();

    data.append('name', name);
    data.append('description', description);
    data.append('latitude', String(localStorage.getItem("hope:latitude")));
    data.append('longitude', String(localStorage.getItem("hope:longitude")));
    data.append('opening_hours', opening_hours);
    data.append('open_on_weekends', String(open_on_weekends));

    images.forEach((image: any) => {
      data.append('images', image);
    });

    await api.post('orphanages', data).then((response: any) => {
      Swal.fire({
        title: 'Uhull!',
        text: 'Orfanato cadastrado com sucesso.',
        icon: 'success',
        confirmButtonText: 'Ok'
      })

      navigate('/map');
    }).catch((error: any) => {

      const { bcode } = error.response.data

      if (bcode === 1001) {
        Swal.fire({
          title: 'Oops!',
          html: `Já existe um cadastro com o nome: </br><i>${name}</i>`,
          icon: 'warning',
          confirmButtonText: 'Voltar'
        })
      } else {
        Swal.fire({
          title: 'Oops!',
          html: `Ocorreu um erro desconhecido.</br>Veja o console do navegador :(`,
          icon: 'error',
          confirmButtonText: 'Voltar'
        })
      }

    })
  }

  return (
    <div id="page-create-orphanage">
      <Sidebar />
      <main>

        <form onSubmit={handleSubmit} className="create-orphanage-form">
          <fieldset>
            <legend>Cadastro</legend>

            { loadPosition && 
              <div className="map">
                <MapContainer center={[loadPosition.latitude, loadPosition.longitude]}
                  scrollWheelZoom={false}
                  style={{ width: '100%', height: 280 }}
                  zoom={15}>
                  <TileLayer url="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {/* <TileLayer
                    url={`https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`}
                  /> */}
                  <Markers />
                </MapContainer>
                {alertPosition && <small className="alert-error">{alertPosition}</small>}
              </div>
            }

            <div className="input-block">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                name="name"
                value={name}
                onChange={event => setName(event.target.value)}
              />
              {alertName && <small className="alert-error">{alertName}</small>}
            </div>

            <div className="input-block">
              <label htmlFor="description">Sobre <span>Máximo de 300 caracteres</span></label>
              <textarea
                id="description"
                name="description"
                value={description}
                onChange={event => setDescription(event.target.value)}
              />
              {alertDescription && <small className="alert-error">{alertDescription}</small>}
            </div>

            <div className="input-block">
              <label htmlFor="images">Fotos</label>

              <div className="images-container">
                {previewImages.map((image) => {
                  return (
                    <div key={image.url}>
                      <span
                        className="remove-image"
                        onClick={() => handleRemoveImage(image)}
                      >
                        <FiX size={18} color="#ff669d" />
                      </span>
                      <img src={image.url} alt={name} className="new-image" />
                    </div>
                  );
                })}


                <label htmlFor="image[]" className="new-image">
                  <FiPlus size={24} color="#15b6d6" />
                </label>
              </div>

              <input multiple onChange={handleSelectImages} type="file" id="image[]" />

              {alertImages && <small className="alert-error">{alertImages}</small>}
            </div>

            <div className="input-block">
              <label htmlFor="opening_hours">Horário de funcinamento</label>
              <input
                id="opening_hours"
                name="opening_hours"
                value={opening_hours}
                onChange={event => setOpeningHours(event.target.value)}
              />
              {alertOh && <small className="alert-error">{alertOh}</small>}
            </div>

            <div className="input-block">
              <label htmlFor="open_on_weekends">Atende fim de semana</label>

              <div className="button-select">
                <button
                  type="button"
                  className={open_on_weekends ? 'active' : ''}
                  onClick={() => setOpenOnWeekends(true)}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className={!open_on_weekends ? 'active' : ''}
                  onClick={() => setOpenOnWeekends(false)}
                >
                  Não
                </button>
              </div>
            </div>
          </fieldset>

          <button className="save-button" type="submit">
            Confirmar
          </button>
        </form>
      </main>
    </div>
  );
}