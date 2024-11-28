"""

"""

import pickle
import torch
import io

# Pickled tensor may be a GPU tensor that cannot be unpickled normally (and tensor.load map_location does not work if saved using pickle)
class CPU_Unpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module == 'torch.storage' and name == '_load_from_bytes':
            return lambda b: torch.load(io.BytesIO(b), map_location='cpu')
        else: return super().find_class(module, name)

# Get the ids
with open('c3_data/well_condition_embeddings.pkl', 'rb') as pkl:
    ids_and_embeddings = CPU_Unpickler(pkl).load()


print('ids', len(ids_and_embeddings))