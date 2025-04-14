import React, { useState, useEffect, useCallback } from 'react'
import CaptchaGrid from './components/CaptchaGrid'

interface Vtuber {
  affiliation: string;
  answer: boolean;
  id: number;
  image: string;
  name: string;
}

interface VtuberData {
  category: string;
  onFail: { extra: any; text: string };
  questions: Vtuber[];
  title: string;
  session: string | null
}

const App: React.FC = () => {
  const [captchaData, setCaptchaData] = useState<VtuberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [serverAuth, setServerAuth] = useState<boolean>(false);
  const [availableOrganizations, setAvailableOrganizations] = useState<string[]>([]);
  const [organization, setOrganization] = useState<string>("Hololive");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const loadCaptchaData = useCallback(() => {
    setLoading(true);
    fetch(import.meta.env.VITE_API_URL + '/api/affiliation/' + organization + (serverAuth ? '?auth=server' : ''))
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response for affiliation endpoint was not ok");
        }
        return response.json();
      })
      .then((jsonData: VtuberData) => {
        setCaptchaData(jsonData);
        setSelectedIndices([]); // Reset selections
        if(serverAuth){
          setSessionId(jsonData.session)
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [organization, serverAuth]);

  useEffect(() => {
    loadCaptchaData();
  }, [loadCaptchaData]);

  useEffect(() => {
    fetch(import.meta.env.VITE_API_URL + '/api/list_orgs')
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response for list of available orgs was not ok");
        }
        return response.json();
      })
      .then((data) => {
        setAvailableOrganizations(data);
      })
      .catch((err) => {
        console.error("Failed to load organizations:", err);
      });
  }, []);

  const verifyResults = () => {
    if (!captchaData) return;
    if (serverAuth) {
      const answerString = selectedIndices
        .map((index) => captchaData.questions[index].id)
        .join(",");
      const formData = new FormData();
      if (sessionId) {
        formData.append('session', sessionId);
      }
      formData.append('answer', answerString);
      fetch(import.meta.env.VITE_API_URL + '/api/verify', {
        method: 'POST',
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("CORRECT! You did it!");
          } else {
            alert("FAILED: You did not select all correct choices or selected an incorrect option");
          }
        })
        .catch((error) => {
          alert("Error verifying answers: " + error.message);
        });
    }
    else {
      const correctIndices = captchaData.questions.reduce<number[]>((acc, question, index) => {
        if (question.answer === true) {
          acc.push(index);
        }
        return acc;
      }, []);

      const sortedSelected = [...selectedIndices].sort((a, b) => a - b);
      const sortedCorrect = [...correctIndices].sort((a, b) => a - b);

      const isEqual =
        sortedSelected.length === sortedCorrect.length &&
        sortedSelected.every((val, index) => val === sortedCorrect[index]);

      if (isEqual) {
        alert("CORRECT! You did it!");
      } else {
        alert("FAILED: You did not select all correct choices or selected an incorrect option");
      }
    }
    loadCaptchaData();
  }


  if (loading) return <div>Loading data...</div>;
  if (error) return <div>Error loading data: {error}</div>;
  if (!captchaData) return <div>No data available</div>;

  const images = captchaData.questions.map((q) => q.image);

  const handleSelectionChange = (indices: number[]) => {
    setSelectedIndices(indices);
  };


  return (
    <>
    <div className="p-4 max-w-screen-sm mx-auto">
      <div className="border border-gray-300 rounded-md shadow-sm bg-white p-4">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-md mr-2">
            <span className="font-bold">i</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">{captchaData.title}</h1>
        </div>

        <p className="text-sm text-gray-600 mb-3">Select all images that match the description</p>

        <CaptchaGrid images={images} onSelectionChange={handleSelectionChange} />

        <div className="mt-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {selectedIndices.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedIndices.map((index) => (
                  <span key={captchaData.questions[index].id} className="bg-gray-100 px-2 py-1 rounded">
                    {captchaData.questions[index].name}
                  </span>
                ))}
              </div>
            ) : (
              <span>None selected</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition duration-200"
              onClick={verifyResults}
            >
              Verify
            </button>
            <button
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition duration-200"
              onClick={loadCaptchaData}
            >
              Regenerate
            </button>
          </div>
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center gap-2 ">
          <span>Organization</span>
          <select
            className={`p-1.5 border rounded bg-gray-200 text-gray-500`}
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          >
            {availableOrganizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <span>Server Side Authentication:</span>
        <select
          className={`p-1.5 border rounded ${!serverAuth ? 'bg-gray-200' : 'bg-white'}`}
          value={serverAuth ? "enable" : "disable"}
          onChange={(e) => setServerAuth(e.target.value === "enable")}
        >
          <option value="enable">Enable</option>
          <option value="disable">Disable</option>
        </select>
      </div>
    </div>
    <div className="mt-6 p-4 bg-gray-50 rounded-lg flex flex-col items-center justify-center shadow-sm border border-gray-200 text-center max-w-screen-md mx-auto">
      <h1 className="text-xl font-semibold text-gray-800 mb-2">VTuber Captcha</h1>
      <p className="text-sm text-gray-600 leading-relaxed">
      Above is a demo component of what the captcha could look like in your application.
      <br className="hidden md:block"/>
      It's strongly recommended that you use a middleware service and store answers on your own server
      rather than relying on the API's server-auth functionality, as session persistence cannot be guaranteed.
      </p>
    </div>
    <footer className="mt-8 py-4 border-t border-gray-200 text-center text-sm text-gray-600">
      <div className="container mx-auto px-4">
      <div className="flex justify-center space-x-4">
        <a href="https://moekyun.me/" className="hover:text-pink-600 transition-colors">
        a moekyun service
        </a>
      </div>
      <div className="flex justify-center space-x-4">
        <a href="https://github.com/pinapelz/vtuber-captcha" className="hover:text-pink-600 transition-colors">
        GitHub
        </a>
      </div>
      </div>
    </footer>
</>      
  );

}

export default App
