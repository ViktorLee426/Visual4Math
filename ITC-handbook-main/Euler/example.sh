#!/bin/bash

#SBATCH -n 2                              # Number of cores
#SBATCH --time=2:00:00                    # hours:minutes:seconds
#SBATCH --tmp=1000                         # per node!!
#SBATCH --mem-per-cpu=10000
#SBATCH --gpus=rtx_4090:1            
#SBATCH --job-name=gen_job
#SBATCH --output=output.out
#SBATCH --error=error.err


module load gcc/8.2.0 python_gpu/3.8.5 eth_proxy
<your python path> <your .py file path> (e.g. /bin/python example.py)

